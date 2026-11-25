import { TeacherAssignmentsManager } from '@/components/dashboard/teacher-assignments-manager';
import {
  renderTeacherPageSafely,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherAssignmentsPage() {
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Assignments" description="Create assignments and quizzes, review submissions, and provide feedback." />
        <TeacherErrorState />
      </div>
    );
  }

  return renderTeacherPageSafely('assignments', async () => {
    const assignmentOptions = await getTeacherAssignmentOptions(context);
    const allowed = new Set(assignmentOptions.map((item) => `${item.classId}:${item.subjectId}`));
    const { data: courseRecords, error: courseError } = await context.supabase.from('lms_courses')
      .select('id, name, class_id, subject_id')
      .eq('school_id', context.schoolId)
      .eq('created_by', context.teacherId);
    if (courseError) throw new Error(`Unable to load your courses: ${courseError.message}`);
    const validCourses = (courseRecords ?? []).filter((course) =>
      course.class_id && course.subject_id && allowed.has(`${course.class_id}:${course.subject_id}`)
    );
    const courseIds = validCourses.map((course) => course.id);

    const [assignmentResult, quizResult] = courseIds.length
      ? await Promise.all([
          context.supabase.from('assignments')
            .select('id, title, description, due_date, max_score, is_published, course_id')
            .in('course_id', courseIds)
            .order('due_date', { ascending: true }),
          context.supabase.from('quizzes')
            .select('id, title, course_id, is_published')
            .in('course_id', courseIds)
            .order('created_at', { ascending: false }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (assignmentResult.error) throw new Error(`Unable to load assignments: ${assignmentResult.error.message}`);
    if (quizResult.error) throw new Error(`Unable to load quizzes: ${quizResult.error.message}`);

    const assignmentIds = (assignmentResult.data ?? []).map((assignment) => assignment.id);
    const { data: submissionRecords, error: submissionError } = assignmentIds.length
      ? await context.supabase.from('submissions')
        .select('id, assignment_id, student_id, submission_text, file_urls, submitted_at, grade, feedback')
          .in('assignment_id', assignmentIds)
          .order('submitted_at', { ascending: false })
      : { data: [], error: null };
    if (submissionError) throw new Error(`Unable to load student submissions: ${submissionError.message}`);

    const studentIds = [...new Set((submissionRecords ?? []).map((submission) => submission.student_id))];
    const assignedCourseClassIds = [...new Set(validCourses.flatMap((course) => course.class_id ? [course.class_id] : []))];
    const [studentsResult, profilesResult] = studentIds.length
      ? await Promise.all([
          context.supabase.from('students').select('id, admission_number').eq('school_id', context.schoolId).in('id', studentIds),
          context.supabase.from('profiles').select('id, full_name').eq('school_id', context.schoolId).in('id', studentIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (studentsResult.error) throw new Error(`Unable to load submission student records: ${studentsResult.error.message}`);
    if (profilesResult.error) throw new Error(`Unable to load submission student names: ${profilesResult.error.message}`);

    const courseById = new Map(validCourses.map((course) => [course.id, course.name]));
    const assignmentById = new Map((assignmentResult.data ?? []).map((assignment) => [assignment.id, assignment]));
    const studentById = new Map((studentsResult.data ?? []).map((student) => [student.id, student]));
    const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
    const { data: activeEnrollments, error: enrollmentError } = studentIds.length && assignedCourseClassIds.length
      ? await context.supabase.from('student_enrollments')
          .select('student_id, class_id')
          .in('student_id', studentIds)
          .in('class_id', assignedCourseClassIds)
          .eq('status', 'active')
      : { data: [], error: null };
    if (enrollmentError) throw new Error(`Unable to verify submission enrollments: ${enrollmentError.message}`);
    const enrollmentPairs = new Set((activeEnrollments ?? []).map((row) => `${row.student_id}:${row.class_id}`));
    const submissionsByAssignment = new Map<string, {
      id: string;
      studentName: string;
      admissionNumber: string | null;
      submissionText: string | null;
      fileUrls: string[] | null;
      submittedAt: string;
      grade: number | null;
      feedback: string | null;
    }[]>();

    for (const submission of submissionRecords ?? []) {
      const assignment = assignmentById.get(submission.assignment_id);
      const course = assignment?.course_id ? validCourses.find((row) => row.id === assignment.course_id) : null;
      const student = studentById.get(submission.student_id);
      if (!assignment || !course?.class_id || !student) continue;
      if (!enrollmentPairs.has(`${submission.student_id}:${course.class_id}`)) continue;

      const rows = submissionsByAssignment.get(assignment.id) ?? [];
      rows.push({
        id: submission.id,
        studentName: profileById.get(student.id) ?? 'Student',
        admissionNumber: student.admission_number,
        submissionText: submission.submission_text,
        fileUrls: submission.file_urls,
        submittedAt: submission.submitted_at,
        grade: submission.grade,
        feedback: submission.feedback,
      });
      submissionsByAssignment.set(assignment.id, rows);
    }

    const assignments = (assignmentResult.data ?? []).flatMap((assignment) => {
      if (!assignment.course_id) return [];
      return [{
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.due_date,
        maxScore: assignment.max_score,
        isPublished: assignment.is_published,
        courseName: courseById.get(assignment.course_id) ?? 'Course',
        submissions: submissionsByAssignment.get(assignment.id) ?? [],
      }];
    });
    const quizzes = (quizResult.data ?? []).flatMap((quiz) => quiz.course_id
      ? [{ id: quiz.id, title: quiz.title, courseName: courseById.get(quiz.course_id) ?? 'Course', isPublished: quiz.is_published }]
      : []);

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Assignments" description="Create assignments and quizzes, review submissions, and provide feedback." />
        <TeacherPanel title="Classroom work" description="Courses and submissions are restricted to class-subject combinations assigned to you.">
          <TeacherAssignmentsManager
            courses={validCourses.map((course) => ({ id: course.id, name: course.name }))}
            assignments={assignments}
            quizzes={quizzes}
          />
        </TeacherPanel>
      </div>
    );
  });
}
