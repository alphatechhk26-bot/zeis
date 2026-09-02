// actions/computer-academy.ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ----------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------

const computerCourseFilterSchema = z.object({
  school_id: z.string().uuid().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'professional']).optional(),
  is_active: z.boolean().optional(),
  search: z.string().optional(),
});

const computerLessonProgressSchema = z.object({
  lesson_id: z.string().uuid(),
  student_id: z.string().uuid(),
  completed: z.boolean().default(true),
});

const certificateEligibilitySchema = z.object({
  student_id: z.string().uuid(),
  computer_course_id: z.string().uuid(),
});

// ----------------------------------------------------------------------
// 1. Fetch computer courses (filtered by level, etc.)
// ----------------------------------------------------------------------

export async function getComputerCourses(input: z.infer<typeof computerCourseFilterSchema>) {
  const { school_id, level, is_active, search } = computerCourseFilterSchema.parse(input);

  const supabase = await createClient();

  let query = supabase.from('computer_courses').select('*');

  if (school_id) {
    query = query.eq('school_id', school_id);
  }
  if (level) {
    query = query.eq('level', level);
  }
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active);
  }
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query.order('level', { ascending: true });
  if (error) throw new Error(`Failed to fetch computer courses: ${error.message}`);

  return data;
}

// ----------------------------------------------------------------------
// 2. Get computer course details with lessons and progress
// ----------------------------------------------------------------------

export async function getComputerCourseWithProgress(computer_course_id: string, student_id: string) {
  const supabase = await createClient();

  // Fetch course
  const { data: course, error: courseError } = await supabase
    .from('computer_courses')
    .select('*')
    .eq('id', computer_course_id)
    .single();

  if (courseError) throw new Error(`Course not found: ${courseError.message}`);

  // Fetch lessons
  const { data: lessons, error: lessonError } = await supabase
    .from('computer_lessons')
    .select('*')
    .eq('computer_course_id', computer_course_id)
    .order('order_index', { ascending: true });

  if (lessonError) throw new Error(`Failed to fetch lessons: ${lessonError.message}`);

  // Fetch progress for this student
  const { data: progress, error: progressError } = await supabase
    .from('computer_progress')
    .select('lesson_id, completed')
    .eq('student_id', student_id)
    .in(
      'lesson_id',
      lessons.map((l) => l.id)
    );

  if (progressError) throw new Error(`Failed to fetch progress: ${progressError.message}`);

  const progressMap = new Map(progress?.map((p) => [p.lesson_id, p.completed]) || []);

  const lessonsWithProgress = lessons.map((lesson) => ({
    ...lesson,
    completed: progressMap.get(lesson.id) || false,
  }));

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
// 3. Record computer lesson progress
// ----------------------------------------------------------------------

export async function recordComputerLessonProgress(input: z.infer<typeof computerLessonProgressSchema>) {
  const { lesson_id, student_id, completed } = computerLessonProgressSchema.parse(input);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('computer_progress')
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

  revalidatePath(`/computer-academy/lesson/${lesson_id}`);
  return { success: true, data: data?.[0] };
}

// ----------------------------------------------------------------------
// 4. Check certificate eligibility for a computer course
// ----------------------------------------------------------------------

export async function checkComputerCertificateEligibility(input: z.infer<typeof certificateEligibilitySchema>) {
  const { student_id, computer_course_id } = certificateEligibilitySchema.parse(input);

  const supabase = await createClient();

  // 1. Get all lessons for the course
  const { data: lessons, error: lessonError } = await supabase
    .from('computer_lessons')
    .select('id')
    .eq('computer_course_id', computer_course_id);

  if (lessonError) throw new Error(`Failed to fetch lessons: ${lessonError.message}`);

  // 2. Check progress: all lessons completed?
  const { data: progress, error: progressError } = await supabase
    .from('computer_progress')
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

  // For computer courses, we might have quizzes or exams; we can check if there is a quiz linked?
  // This is optional; we can assume course completion is enough for certificate.
  // But we can also check for a passing score in a final exam if we had that data.
  // For simplicity, we'll return eligible if all lessons done.

  return { eligible: true, reason: 'All requirements met.' };
}