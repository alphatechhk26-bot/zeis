import { redirect, unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ROLE_DASHBOARD_PATHS = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
} as const;

export async function requireTeacherContext() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to initialize the teacher dashboard connection:', error);
    return { error: 'connection' as const };
  }

  let authResult;
  try {
    authResult = await supabase.auth.getUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to verify the teacher dashboard session:', error);
    return { error: 'authentication' as const };
  }

  if (authResult.error) {
    console.error('Unable to verify the teacher dashboard session:', authResult.error);
    return { error: 'authentication' as const };
  }

  const user = authResult.data.user;
  if (!user) {
    redirect('/login?redirectedFrom=/dashboard/teacher');
  }

  let profileResult;
  try {
    profileResult = await supabase
      .from('profiles')
      .select('id, role, full_name, school_id')
      .eq('id', user.id)
      .maybeSingle();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to load the teacher dashboard profile:', error);
    return { error: 'profile' as const };
  }

  if (profileResult.error) {
    console.error('Unable to load the teacher dashboard profile:', profileResult.error);
    return { error: 'profile' as const };
  }
  if (!profileResult.data) {
    return { error: 'profile' as const };
  }

  const profile = profileResult.data;
  if (profile.role !== 'teacher') {
    redirect(ROLE_DASHBOARD_PATHS[profile.role]);
  }

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('id, school_id')
    .eq('id', user.id)
    .maybeSingle();

  if (teacherError) {
    console.error('Unable to load the teacher dashboard record:', teacherError);
    return { error: 'teacher' as const };
  }
  if (!teacher || !profile.school_id || teacher.school_id !== profile.school_id) {
    return { error: 'teacher' as const };
  }

  return { supabase, teacherId: teacher.id, profile, schoolId: teacher.school_id };
}

export function formatTeacherDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export async function getTeacherAssignmentOptions(
  context: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    teacherId: string;
    schoolId: string;
  },
) {
  const { supabase, teacherId, schoolId } = context;
  const { data: assignments, error: assignmentError } = await supabase
    .from('teacher_assignments')
    .select('class_id, subject_id, academic_year_id')
    .eq('teacher_id', teacherId);
  if (assignmentError) throw new Error(`Unable to load your teaching assignments: ${assignmentError.message}`);

  const classIds = [...new Set((assignments ?? []).map((assignment) => assignment.class_id))];
  const subjectIds = [...new Set((assignments ?? []).map((assignment) => assignment.subject_id))];
  const yearIds = [...new Set((assignments ?? []).map((assignment) => assignment.academic_year_id))];
  if (!classIds.length || !subjectIds.length || !yearIds.length) return [];

  const [classesResult, subjectsResult, yearsResult, classSubjectsResult] = await Promise.all([
    supabase.from('classes').select('id, name, school_id').eq('school_id', schoolId).in('id', classIds),
    supabase.from('subjects').select('id, name, school_id').eq('school_id', schoolId).in('id', subjectIds),
    supabase.from('academic_years').select('id, name, school_id').eq('school_id', schoolId).in('id', yearIds),
    supabase
      .from('class_subjects')
      .select('class_id, subject_id, academic_year_id, is_active')
      .in('class_id', classIds)
      .in('subject_id', subjectIds)
      .in('academic_year_id', yearIds),
  ]);
  if (classesResult.error) throw new Error(`Unable to load your assigned classes: ${classesResult.error.message}`);
  if (subjectsResult.error) throw new Error(`Unable to load your assigned subjects: ${subjectsResult.error.message}`);
  if (yearsResult.error) throw new Error(`Unable to load your academic years: ${yearsResult.error.message}`);
  if (classSubjectsResult.error) throw new Error(`Unable to verify class-subject assignments: ${classSubjectsResult.error.message}`);

  const classes = new Map((classesResult.data ?? []).map((row) => [row.id, row]));
  const subjects = new Map((subjectsResult.data ?? []).map((row) => [row.id, row]));
  const years = new Map((yearsResult.data ?? []).map((row) => [row.id, row]));
  const validRelationships = new Set(
    (classSubjectsResult.data ?? [])
      .filter((row) => row.is_active !== false)
      .map((row) => `${row.class_id}:${row.subject_id}:${row.academic_year_id}`),
  );

  return (assignments ?? [])
    .filter((assignment) => validRelationships.has(
      `${assignment.class_id}:${assignment.subject_id}:${assignment.academic_year_id}`,
    ))
    .flatMap((assignment) => {
      const classroom = classes.get(assignment.class_id);
      const subject = subjects.get(assignment.subject_id);
      const year = years.get(assignment.academic_year_id);
      return classroom && subject && year
        ? [{
            classId: classroom.id,
            className: classroom.name,
            subjectId: subject.id,
            subjectName: subject.name,
            academicYearId: year.id,
            academicYearName: year.name,
          }]
        : [];
    });
}
