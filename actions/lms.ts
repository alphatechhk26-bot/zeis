// actions/lms.ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ----------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------

const courseFilterSchema = z.object({
  school_id: z.string().uuid().optional(),
  is_published: z.boolean().optional(),
  search: z.string().optional(),
});

const lessonProgressSchema = z.object({
  lesson_id: z.string().uuid(),
  student_id: z.string().uuid(),
  completed: z.boolean().default(true),
});

const assignmentSubmissionSchema = z.object({
  assignment_id: z.string().uuid(),
  submission_text: z.string().max(10000).optional(),
  file_urls: z.array(z.string().url()).optional(),
});

const gradeAssignmentSchema = z.object({
  submission_id: z.string().uuid(),
  grade: z.number().min(0),
  feedback: z.string().optional(),
});

const quizAutoGradeSchema = z.object({
  attempt_id: z.string().uuid(),
});

const certificateEligibilitySchema = z.object({
  student_id: z.string().uuid(),
  course_id: z.string().uuid(),
});

// ----------------------------------------------------------------------
// 1. Fetch courses (with optional filters)
// ----------------------------------------------------------------------

export async function getLmsCourses(input: z.infer<typeof courseFilterSchema>) {
  const { school_id, is_published, search } = courseFilterSchema.parse(input);

  const supabase = await createClient();

  let query = supabase.from('lms_courses').select('*');

  if (school_id) {
    query = query.eq('school_id', school_id);
  }
  if (is_published !== undefined) {
    query = query.eq('is_published', is_published);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch courses: ${error.message}`);

  return data;
}

// ----------------------------------------------------------------------
// 2. Get course details with lessons and progress for a student
// ----------------------------------------------------------------------

export async function getCourseWithProgress(course_id: string, student_id: string) {
  const supabase = await createClient();

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from('lms_courses')
    .select('*')
    .eq('id', course_id)
    .single();

  if (courseError) throw new Error(`Course not found: ${courseError.message}`);

  // Fetch lessons
  const { data: lessons, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', course_id)
    .order('order_index', { ascending: true });

  if (lessonError) throw new Error(`Failed to fetch lessons: ${lessonError.message}`);

  // Fetch progress for this student
  const { data: progress, error: progressError } = await supabase
    .from('lms_progress')
    .select('lesson_id, completed')
    .eq('student_id', student_id)
    .in('lesson_id', lessons.map((l) => l.id));

  if (progressError) throw new Error(`Failed to fetch progress: ${progressError.message}`);

  const progressMap = new Map(progress?.map((p) => [p.lesson_id, p.completed]) || []);

  const lessonsWithProgress = lessons.map((lesson) => ({
    ...lesson,
    completed: progressMap.get(lesson.id) || false,
  }));

  // Calculate overall progress
  const total = lessonsWithProgress.length;
  const completedCount = lessonsWithProgress.filter((l) => l.completed).length;
  const progressPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return {
    ...course,
    lessons: lessonsWithProgress,
    progress_percentage: progressPercentage,
  };
}

// ----------------------------------------------------------------------
// 3. Record lesson completion progress (upsert)
// ----------------------------------------------------------------------

export async function recordLessonProgress(input: z.infer<typeof lessonProgressSchema>) {
  const { lesson_id, student_id, completed } = lessonProgressSchema.parse(input);

  const supabase = await createClient();

  // Upsert progress
  const { data, error } = await supabase
    .from('lms_progress')
    .upsert(
      {
        student_id,
        lesson_id,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'student_id, lesson_id',
        ignoreDuplicates: false,
      }
    )
    .select();

  if (error) throw new Error(`Failed to record progress: ${error.message}`);

  revalidatePath(`/lms/course/${lesson_id}`);
  return { success: true, data: data?.[0] };
}

// ----------------------------------------------------------------------
// 4. Submit assignment (student)
// ----------------------------------------------------------------------

export async function submitAssignment(input: z.infer<typeof assignmentSubmissionSchema>) {
  const { assignment_id, submission_text, file_urls } =
    assignmentSubmissionSchema.parse(input);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error('Unauthorized');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'student') {
    throw new Error('Only students can submit assignments.');
  }
  if (!profile.school_id) throw new Error('Your account is not assigned to a school.');

  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('course_id')
    .eq('id', assignment_id)
    .eq('is_published', true)
    .single();

  if (assignmentError || !assignment?.course_id) {
    throw new Error('Assignment not found or no longer available.');
  }

  const { data: course, error: courseError } = await supabase
    .from('lms_courses')
    .select('id')
    .eq('id', assignment.course_id)
    .eq('school_id', profile.school_id)
    .eq('is_published', true)
    .single();

  if (courseError || !course) {
    throw new Error('Assignment is not available to your school.');
  }

  // Check if submission already exists
  const { data: existing, error: existingError } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignment_id)
    .eq('student_id', user.id)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to check existing submission: ${existingError.message}`);

  let result;
  if (existing) {
    // Update existing submission
    const updates = {
      submission_text: submission_text || null,
      submitted_at: new Date().toISOString(),
      status: 'submitted' as const,
      grade: null,
      feedback: null,
      graded_at: null,
      ...(file_urls !== undefined ? { file_urls } : {}),
    };
    const { data, error } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', existing.id)
      .eq('student_id', user.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update submission: ${error.message}`);
    result = data;
  } else {
    // Insert new submission
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id,
        student_id: user.id,
        submission_text: submission_text || null,
        file_urls: file_urls ?? null,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to submit assignment: ${error.message}`);
    result = data;
  }

  revalidatePath('/dashboard/student/assignments');
  return { success: true, data: result };
}

// ----------------------------------------------------------------------
// 5. Grade assignment (teacher/admin)
// ----------------------------------------------------------------------

export async function gradeAssignment(input: z.infer<typeof gradeAssignmentSchema>) {
  const { submission_id, grade, feedback } = gradeAssignmentSchema.parse(input);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('submissions')
    .update({
      grade,
      feedback: feedback || null,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .eq('id', submission_id)
    .select()
    .single();

  if (error) throw new Error(`Failed to grade assignment: ${error.message}`);

  revalidatePath(`/lms/submissions/${submission_id}`);
  return { success: true, data };
}

// ----------------------------------------------------------------------
// 6. Auto-grade a quiz attempt (based on correct answers)
// ----------------------------------------------------------------------

export async function autoGradeQuiz(input: z.infer<typeof quizAutoGradeSchema>) {
  const { attempt_id } = quizAutoGradeSchema.parse(input);

  const supabase = await createClient();

  // Fetch attempt and quiz
  const { data: attempt, error: attemptError } = await supabase
    .from('quiz_attempts')
    .select('quiz_id, student_id')
    .eq('id', attempt_id)
    .single();

  if (attemptError) throw new Error(`Attempt not found: ${attemptError.message}`);

  // Fetch quiz questions with correct answers
  const { data: questions, error: qError } = await supabase
    .from('quiz_questions')
    .select('id, correct_answer, marks')
    .eq('quiz_id', attempt.quiz_id);

  if (qError) throw new Error(`Failed to fetch questions: ${qError.message}`);

  // Fetch student's responses for this attempt
  const { data: responses, error: rError } = await supabase
    .from('quiz_responses')
    .select('question_id, selected_option, text_response')
    .eq('attempt_id', attempt_id);

  if (rError) throw new Error(`Failed to fetch responses: ${rError.message}`);

  // Build a map of question_id -> response
  const responseMap = new Map(
    responses?.map((r) => [r.question_id, r.selected_option || r.text_response || ''])
  );

  let totalMarks = 0;
  let obtainedMarks = 0;

  for (const q of questions || []) {
    const response = responseMap.get(q.id);
    const isCorrect = response === q.correct_answer;
    totalMarks += q.marks || 0;
    if (isCorrect) {
      obtainedMarks += q.marks || 0;
    }
    // Update the response with is_correct flag
    await supabase
      .from('quiz_responses')
      .update({ is_correct: isCorrect })
      .eq('attempt_id', attempt_id)
      .eq('question_id', q.id);
  }

  // Calculate score as percentage
  const score = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;

  // Update attempt with score and status
  const { data: updatedAttempt, error: updateError } = await supabase
    .from('quiz_attempts')
    .update({
      score,
      status: 'completed',
      end_time: new Date().toISOString(),
    })
    .eq('id', attempt_id)
    .select()
    .single();

  if (updateError) throw new Error(`Failed to update attempt: ${updateError.message}`);

  revalidatePath(`/lms/quiz/${attempt.quiz_id}`);
  return { success: true, score, totalMarks, obtainedMarks, data: updatedAttempt };
}

// ----------------------------------------------------------------------
// 7. Check certificate eligibility for an LMS course
// ----------------------------------------------------------------------

export async function checkLmsCertificateEligibility(input: z.infer<typeof certificateEligibilitySchema>) {
  const { student_id, course_id } = certificateEligibilitySchema.parse(input);

  const supabase = await createClient();

  // 1. Get all lessons for the course
  const { data: lessons, error: lessonError } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', course_id);

  if (lessonError) throw new Error(`Failed to fetch lessons: ${lessonError.message}`);

  // 2. Check progress: all lessons completed?
  const { data: progress, error: progressError } = await supabase
    .from('lms_progress')
    .select('lesson_id, completed')
    .eq('student_id', student_id)
    .in(
      'lesson_id',
      lessons.map((l) => l.id)
    );

  if (progressError) throw new Error(`Failed to fetch progress: ${progressError.message}`);

  const completedLessons = progress?.filter((p) => p.completed).map((p) => p.lesson_id) || [];
  const allLessonsCompleted = lessons.every((l) => completedLessons.includes(l.id));

  if (!allLessonsCompleted) {
    return { eligible: false, reason: 'Not all lessons are completed.' };
  }

  // 3. Check quizzes: find all quizzes for this course
  const { data: quizzes, error: quizError } = await supabase
    .from('quizzes')
    .select('id, passing_score')
    .eq('course_id', course_id);

  if (quizError) throw new Error(`Failed to fetch quizzes: ${quizError.message}`);

  // For each quiz, get the latest completed attempt with score >= passing_score
  for (const quiz of quizzes || []) {
    const { data: attempts, error: attError } = await supabase
      .from('quiz_attempts')
      .select('score')
      .eq('quiz_id', quiz.id)
      .eq('student_id', student_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (attError) throw new Error(`Failed to fetch quiz attempts: ${attError.message}`);

    const bestAttempt = attempts?.[0];
    if (!bestAttempt || (bestAttempt.score || 0) < (quiz.passing_score || 0)) {
      return {
        eligible: false,
        reason: `Quiz "${quiz.id}" not passed (score ${bestAttempt?.score || 'N/A'}, required ${quiz.passing_score}).`,
      };
    }
  }

  // If we reach here, all lessons and quizzes passed
  return { eligible: true, reason: 'All requirements met.' };
}