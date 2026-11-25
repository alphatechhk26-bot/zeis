'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

const uuid = z.string().uuid();
const date = z.string().date();
const attendanceStatus = z.enum(['present', 'absent', 'late', 'excused']);

async function getContext() {
  const context = await requireTeacherContext();
  if ('error' in context) throw new Error('A valid teacher profile and school assignment are required.');
  return context;
}

async function requireAssignment(
  context: Awaited<ReturnType<typeof getContext>>,
  classId: string,
  subjectId: string,
  academicYearId: string,
) {
  const assignments = await getTeacherAssignmentOptions(context);
  if (!assignments.some((assignment) =>
    assignment.classId === classId &&
    assignment.subjectId === subjectId &&
    assignment.academicYearId === academicYearId
  )) {
    throw new Error('You are not assigned to this class and subject for the selected academic year.');
  }
}

async function requireOwnedCourse(
  context: Awaited<ReturnType<typeof getContext>>,
  courseId: string,
) {
  const { data: course, error } = await context.supabase
    .from('lms_courses')
    .select('id, class_id, subject_id')
    .eq('id', courseId)
    .eq('school_id', context.schoolId)
    .eq('created_by', context.teacherId)
    .maybeSingle();
  if (error) throw new Error(`Unable to verify course ownership: ${error.message}`);
  if (!course?.class_id || !course.subject_id) throw new Error('Course not found or not assigned to you.');

  const assignments = await getTeacherAssignmentOptions(context);
  if (!assignments.some((assignment) =>
    assignment.classId === course.class_id && assignment.subjectId === course.subject_id
  )) {
    throw new Error('This course is no longer linked to one of your assigned subjects.');
  }
  return course;
}

const attendanceRosterSchema = z.object({
  classId: uuid,
  academicYearId: uuid,
  attendanceDate: date,
});

export async function getTeacherAttendanceRoster(input: z.infer<typeof attendanceRosterSchema>) {
  const value = attendanceRosterSchema.parse(input);
  const context = await getContext();
  const assignment = (await getTeacherAssignmentOptions(context)).find((item) =>
    item.classId === value.classId && item.academicYearId === value.academicYearId
  );
  if (!assignment) throw new Error('This class and academic year are not assigned to you.');

  const { data: enrollments, error: enrollmentError } = await context.supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('class_id', value.classId)
    .eq('academic_year_id', value.academicYearId)
    .eq('status', 'active');
  if (enrollmentError) throw new Error(`Unable to load enrolled students: ${enrollmentError.message}`);

  const studentIds = [...new Set((enrollments ?? []).map((row) => row.student_id))];
  if (!studentIds.length) return [];

  const [studentsResult, profilesResult, attendanceResult] = await Promise.all([
    context.supabase
      .from('students')
      .select('id, admission_number')
      .eq('school_id', context.schoolId)
      .in('id', studentIds),
    context.supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds)
      .eq('school_id', context.schoolId),
    context.supabase
      .from('attendance')
      .select('student_id, status, remarks')
      .eq('school_id', context.schoolId)
      .eq('class_id', value.classId)
      .eq('academic_year_id', value.academicYearId)
      .eq('attendance_date', value.attendanceDate)
      .in('student_id', studentIds),
  ]);
  if (studentsResult.error) throw new Error(`Unable to load student records: ${studentsResult.error.message}`);
  if (profilesResult.error) throw new Error(`Unable to load student names: ${profilesResult.error.message}`);
  if (attendanceResult.error) throw new Error(`Unable to load existing attendance: ${attendanceResult.error.message}`);

  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name]));
  const records = new Map((attendanceResult.data ?? []).map((row) => [row.student_id, row]));
  return (studentsResult.data ?? []).map((student) => {
    const record = records.get(student.id);
    return {
      studentId: student.id,
      admissionNumber: student.admission_number,
      fullName: profiles.get(student.id) ?? 'Student',
      status: record?.status ?? 'present',
      remarks: record?.remarks ?? '',
    };
  });
}

const saveAttendanceSchema = z.object({
  classId: uuid,
  academicYearId: uuid,
  attendanceDate: date,
  records: z.array(z.object({
    studentId: uuid,
    status: attendanceStatus,
    remarks: z.string().trim().max(500).optional(),
  })).min(1).max(500),
}).superRefine((value, ctx) => {
  if (new Set(value.records.map((record) => record.studentId)).size !== value.records.length) {
    ctx.addIssue({ code: 'custom', message: 'A student appears more than once in this attendance batch.' });
  }
});

export async function saveTeacherAttendance(input: z.infer<typeof saveAttendanceSchema>) {
  const value = saveAttendanceSchema.parse(input);
  const context = await getContext();
  const assignments = await getTeacherAssignmentOptions(context);
  if (!assignments.some((item) =>
    item.classId === value.classId && item.academicYearId === value.academicYearId
  )) {
    throw new Error('This class and academic year are not assigned to you.');
  }

  const studentIds = value.records.map((record) => record.studentId);
  const { data: enrollments, error: enrollmentError } = await context.supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('class_id', value.classId)
    .eq('academic_year_id', value.academicYearId)
    .eq('status', 'active')
    .in('student_id', studentIds);
  if (enrollmentError) throw new Error(`Unable to verify student enrollments: ${enrollmentError.message}`);
  const enrolledIds = new Set((enrollments ?? []).map((row) => row.student_id));
  if (studentIds.some((id) => !enrolledIds.has(id))) {
    throw new Error('Attendance can only be recorded for actively enrolled students in this class.');
  }

  const rows = value.records.map((record) => ({
    student_id: record.studentId,
    class_id: value.classId,
    academic_year_id: value.academicYearId,
    school_id: context.schoolId,
    attendance_date: value.attendanceDate,
    status: record.status,
    remarks: record.remarks || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await context.supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'student_id,class_id,attendance_date' });
  if (error) throw new Error(`Unable to save attendance: ${error.message}`);

  revalidatePath('/dashboard/teacher/attendance');
  return { success: true, count: rows.length };
}

const examRosterSchema = z.object({ examId: uuid });

export async function getTeacherExamRoster(input: z.infer<typeof examRosterSchema>) {
  const { examId } = examRosterSchema.parse(input);
  const context = await getContext();
  const { data: exam, error: examError } = await context.supabase
    .from('exams')
    .select('id, class_id, subject_id, academic_year_id, max_marks')
    .eq('id', examId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (examError) throw new Error(`Unable to load exam: ${examError.message}`);
  if (!exam) throw new Error('Exam not found in your school.');
  await requireAssignment(context, exam.class_id, exam.subject_id, exam.academic_year_id);

  const { data: enrollments, error: enrollmentError } = await context.supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('class_id', exam.class_id)
    .eq('academic_year_id', exam.academic_year_id)
    .eq('status', 'active');
  if (enrollmentError) throw new Error(`Unable to load enrolled students: ${enrollmentError.message}`);
  const ids = [...new Set((enrollments ?? []).map((row) => row.student_id))];
  if (!ids.length) return { maxMarks: exam.max_marks, students: [] };

  const [studentsResult, profilesResult, resultsResult] = await Promise.all([
    context.supabase.from('students').select('id, admission_number').eq('school_id', context.schoolId).in('id', ids),
    context.supabase.from('profiles').select('id, full_name').eq('school_id', context.schoolId).in('id', ids),
    context.supabase.from('results').select('student_id, marks_obtained, remarks').eq('school_id', context.schoolId).eq('exam_id', examId).in('student_id', ids),
  ]);
  if (studentsResult.error) throw new Error(`Unable to load student records: ${studentsResult.error.message}`);
  if (profilesResult.error) throw new Error(`Unable to load student names: ${profilesResult.error.message}`);
  if (resultsResult.error) throw new Error(`Unable to load existing marks: ${resultsResult.error.message}`);

  const profiles = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name]));
  const results = new Map((resultsResult.data ?? []).map((row) => [row.student_id, row]));
  return {
    maxMarks: exam.max_marks,
    students: (studentsResult.data ?? []).map((student) => ({
      studentId: student.id,
      admissionNumber: student.admission_number,
      fullName: profiles.get(student.id) ?? 'Student',
      marks: results.get(student.id)?.marks_obtained,
      remarks: results.get(student.id)?.remarks ?? '',
    })),
  };
}

const saveResultsSchema = z.object({
  examId: uuid,
  records: z.array(z.object({
    studentId: uuid,
    marks: z.number().finite().min(0),
    remarks: z.string().trim().max(1000).optional(),
  })).min(1).max(500),
}).superRefine((value, ctx) => {
  if (new Set(value.records.map((record) => record.studentId)).size !== value.records.length) {
    ctx.addIssue({ code: 'custom', message: 'A student appears more than once in this marks batch.' });
  }
});

export async function saveTeacherExamResults(input: z.infer<typeof saveResultsSchema>) {
  const value = saveResultsSchema.parse(input);
  const context = await getContext();
  const { data: exam, error: examError } = await context.supabase
    .from('exams')
    .select('id, class_id, subject_id, academic_year_id, max_marks')
    .eq('id', value.examId)
    .eq('school_id', context.schoolId)
    .maybeSingle();
  if (examError) throw new Error(`Unable to verify exam: ${examError.message}`);
  if (!exam) throw new Error('Exam not found in your school.');
  await requireAssignment(context, exam.class_id, exam.subject_id, exam.academic_year_id);
  if (value.records.some((record) => record.marks > exam.max_marks)) {
    throw new Error(`Marks cannot exceed the exam maximum of ${exam.max_marks}.`);
  }

  const ids = value.records.map((record) => record.studentId);
  const { data: enrollments, error: enrollmentError } = await context.supabase
    .from('student_enrollments')
    .select('student_id')
    .eq('class_id', exam.class_id)
    .eq('academic_year_id', exam.academic_year_id)
    .eq('status', 'active')
    .in('student_id', ids);
  if (enrollmentError) throw new Error(`Unable to verify student enrollments: ${enrollmentError.message}`);
  const enrolledIds = new Set((enrollments ?? []).map((row) => row.student_id));
  if (ids.some((id) => !enrolledIds.has(id))) {
    throw new Error('Marks can only be entered for actively enrolled students in this exam class.');
  }

  const rows = value.records.map((record) => ({
    exam_id: exam.id,
    student_id: record.studentId,
    school_id: context.schoolId,
    marks_obtained: record.marks,
    remarks: record.remarks || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await context.supabase
    .from('results')
    .upsert(rows, { onConflict: 'student_id,exam_id' });
  if (error) throw new Error(`Unable to save exam marks: ${error.message}`);

  revalidatePath('/dashboard/teacher/exams');
  return { success: true, count: rows.length };
}

const assignmentSchema = z.object({
  courseId: uuid,
  lessonId: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(10000).optional(),
  dueDate: date.optional(),
  maxScore: z.number().finite().positive().max(100000),
  isPublished: z.boolean(),
});

export async function createTeacherAssignment(input: z.infer<typeof assignmentSchema>) {
  const value = assignmentSchema.parse(input);
  const context = await getContext();
  await requireOwnedCourse(context, value.courseId);
  if (value.lessonId) {
    const { data: lesson, error } = await context.supabase
      .from('lessons')
      .select('id')
      .eq('id', value.lessonId)
      .eq('course_id', value.courseId)
      .maybeSingle();
    if (error) throw new Error(`Unable to verify lesson: ${error.message}`);
    if (!lesson) throw new Error('The selected lesson does not belong to this course.');
  }
  const { error } = await context.supabase.from('assignments').insert({
    course_id: value.courseId,
    lesson_id: value.lessonId ?? null,
    title: value.title,
    description: value.instructions || null,
    due_date: value.dueDate ?? null,
    max_score: value.maxScore,
    is_published: value.isPublished,
  });
  if (error) throw new Error(`Unable to create assignment: ${error.message}`);
  revalidatePath('/dashboard/teacher/assignments');
  return { success: true };
}

const gradeSubmissionSchema = z.object({
  submissionId: uuid,
  grade: z.number().finite().min(0),
  feedback: z.string().trim().max(5000).optional(),
});

export async function gradeTeacherSubmission(input: z.infer<typeof gradeSubmissionSchema>) {
  const value = gradeSubmissionSchema.parse(input);
  const context = await getContext();
  const { data: submission, error: submissionError } = await context.supabase
    .from('submissions')
    .select('id, assignment_id, student_id')
    .eq('id', value.submissionId)
    .maybeSingle();
  if (submissionError) throw new Error(`Unable to load submission: ${submissionError.message}`);
  if (!submission) throw new Error('Submission not found.');

  const { data: assignment, error: assignmentError } = await context.supabase
    .from('assignments')
    .select('id, course_id, max_score')
    .eq('id', submission.assignment_id)
    .maybeSingle();
  if (assignmentError) throw new Error(`Unable to load assignment: ${assignmentError.message}`);
  if (!assignment?.course_id) throw new Error('Submission is not linked to a course.');
  const course = await requireOwnedCourse(context, assignment.course_id);
  if (!course.class_id) throw new Error('Course is not linked to a class.');
  if (value.grade > assignment.max_score) throw new Error('The grade cannot exceed the assignment maximum score.');

  const [studentResult, enrollmentResult] = await Promise.all([
    context.supabase.from('students').select('id').eq('id', submission.student_id).eq('school_id', context.schoolId).maybeSingle(),
    context.supabase.from('student_enrollments').select('student_id').eq('student_id', submission.student_id).eq('class_id', course.class_id).eq('status', 'active').limit(1),
  ]);
  if (studentResult.error) throw new Error(`Unable to verify student: ${studentResult.error.message}`);
  if (enrollmentResult.error) throw new Error(`Unable to verify class enrollment: ${enrollmentResult.error.message}`);
  if (!studentResult.data || !enrollmentResult.data?.length) {
    throw new Error('This student is not actively enrolled in your course class.');
  }

  const { error } = await context.supabase.from('submissions').update({
    grade: value.grade,
    feedback: value.feedback || null,
    status: 'graded',
    graded_at: new Date().toISOString(),
    graded_by: context.teacherId,
    updated_at: new Date().toISOString(),
  }).eq('id', submission.id);
  if (error) throw new Error(`Unable to grade submission: ${error.message}`);
  revalidatePath('/dashboard/teacher/assignments');
  return { success: true };
}

const quizQuestionSchema = z.object({
  questionText: z.string().trim().min(1).max(2000),
  questionType: z.enum(['multiple_choice', 'true_false', 'short_answer']),
  options: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  correctAnswer: z.string().trim().min(1).max(1000),
  marks: z.number().finite().positive().max(10000),
}).superRefine((question, ctx) => {
  if (question.questionType === 'multiple_choice') {
    const options = question.options ?? [];
    if (options.length < 2 || new Set(options).size !== options.length) {
      ctx.addIssue({ code: 'custom', message: 'Multiple-choice questions need at least two unique options.' });
    } else if (!options.includes(question.correctAnswer)) {
      ctx.addIssue({ code: 'custom', message: 'The correct answer must match one of the question options.' });
    }
  }
  if (question.questionType === 'true_false' && !['true', 'false'].includes(question.correctAnswer.toLowerCase())) {
    ctx.addIssue({ code: 'custom', message: 'A true/false question must use true or false as its answer.' });
  }
});

const quizSchema = z.object({
  courseId: uuid,
  lessonId: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  timeLimitMinutes: z.number().int().positive().max(600).optional(),
  passingScore: z.number().finite().min(0).max(100).optional(),
  isPublished: z.boolean(),
  questions: z.array(quizQuestionSchema).min(1).max(100),
});

export async function createTeacherQuiz(input: z.infer<typeof quizSchema>) {
  const value = quizSchema.parse(input);
  const context = await getContext();
  await requireOwnedCourse(context, value.courseId);
  if (value.lessonId) {
    const { data: lesson, error } = await context.supabase.from('lessons')
      .select('id').eq('id', value.lessonId).eq('course_id', value.courseId).maybeSingle();
    if (error) throw new Error(`Unable to verify lesson: ${error.message}`);
    if (!lesson) throw new Error('The selected lesson does not belong to this course.');
  }
  const { data: quiz, error: quizError } = await context.supabase.from('quizzes').insert({
    course_id: value.courseId,
    lesson_id: value.lessonId ?? null,
    title: value.title,
    description: value.description || null,
    time_limit_minutes: value.timeLimitMinutes ?? null,
    passing_score: value.passingScore ?? null,
    is_published: value.isPublished,
  }).select('id').single();
  if (quizError) throw new Error(`Unable to create quiz: ${quizError.message}`);

  const questions = value.questions.map((question, index) => ({
    quiz_id: quiz.id,
    question_text: question.questionText,
    question_type: question.questionType,
    options: question.options ?? null,
    correct_answer: question.correctAnswer,
    marks: question.marks,
    order_index: index + 1,
  }));
  const { error: questionError } = await context.supabase.from('quiz_questions').insert(questions);
  if (questionError) {
    const { error: rollbackError } = await context.supabase.from('quizzes').delete().eq('id', quiz.id);
    if (rollbackError) {
      throw new Error(`Unable to save quiz questions (${questionError.message}) or remove the incomplete quiz (${rollbackError.message}).`);
    }
    throw new Error(`Unable to save quiz questions; the incomplete quiz was removed: ${questionError.message}`);
  }

  revalidatePath('/dashboard/teacher/assignments');
  return { success: true, quizId: quiz.id };
}

const courseSchema = z.object({
  classId: uuid,
  subjectId: uuid,
  academicYearId: uuid,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
});

export async function createTeacherCourse(input: z.infer<typeof courseSchema>) {
  const value = courseSchema.parse(input);
  const context = await getContext();
  await requireAssignment(context, value.classId, value.subjectId, value.academicYearId);
  const { error } = await context.supabase.from('lms_courses').insert({
    name: value.name,
    description: value.description || null,
    class_id: value.classId,
    subject_id: value.subjectId,
    school_id: context.schoolId,
    created_by: context.teacherId,
    is_published: false,
  });
  if (error) throw new Error(`Unable to create course: ${error.message}`);
  revalidatePath('/dashboard/teacher/lms');
  revalidatePath('/dashboard/teacher/assignments');
  return { success: true };
}

const updateCourseSchema = z.object({
  courseId: uuid,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  isPublished: z.boolean(),
});

export async function updateTeacherCourse(input: z.infer<typeof updateCourseSchema>) {
  const value = updateCourseSchema.parse(input);
  const context = await getContext();
  await requireOwnedCourse(context, value.courseId);
  const { error } = await context.supabase.from('lms_courses').update({
    name: value.name,
    description: value.description || null,
    is_published: value.isPublished,
    updated_at: new Date().toISOString(),
  }).eq('id', value.courseId).eq('school_id', context.schoolId).eq('created_by', context.teacherId);
  if (error) throw new Error(`Unable to update course: ${error.message}`);
  revalidatePath('/dashboard/teacher/lms');
  return { success: true };
}

const lessonSchema = z.object({
  courseId: uuid,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(20000).optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  isPublished: z.boolean(),
});

export async function createTeacherLesson(input: z.infer<typeof lessonSchema>) {
  const value = lessonSchema.parse(input);
  const context = await getContext();
  await requireOwnedCourse(context, value.courseId);
  const { data: lastLesson, error: orderError } = await context.supabase.from('lessons')
    .select('order_index').eq('course_id', value.courseId).order('order_index', { ascending: false }).limit(1).maybeSingle();
  if (orderError) throw new Error(`Unable to determine lesson order: ${orderError.message}`);
  const { error } = await context.supabase.from('lessons').insert({
    course_id: value.courseId,
    title: value.title,
    content: value.content || null,
    video_url: value.videoUrl || null,
    is_published: value.isPublished,
    order_index: (lastLesson?.order_index ?? 0) + 1,
  });
  if (error) throw new Error(`Unable to add lesson: ${error.message}`);
  revalidatePath('/dashboard/teacher/lms');
  return { success: true };
}

const updateLessonSchema = z.object({
  lessonId: uuid,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(20000).optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  isPublished: z.boolean(),
});

export async function updateTeacherLesson(input: z.infer<typeof updateLessonSchema>) {
  const value = updateLessonSchema.parse(input);
  const context = await getContext();
  const { data: lesson, error: lessonError } = await context.supabase.from('lessons')
    .select('id, course_id').eq('id', value.lessonId).maybeSingle();
  if (lessonError) throw new Error(`Unable to load lesson: ${lessonError.message}`);
  if (!lesson) throw new Error('Lesson not found.');
  await requireOwnedCourse(context, lesson.course_id);
  const { error } = await context.supabase.from('lessons').update({
    title: value.title,
    content: value.content || null,
    video_url: value.videoUrl || null,
    is_published: value.isPublished,
    updated_at: new Date().toISOString(),
  }).eq('id', lesson.id).eq('course_id', lesson.course_id);
  if (error) throw new Error(`Unable to update lesson: ${error.message}`);
  revalidatePath('/dashboard/teacher/lms');
  return { success: true };
}
