import { redirect, unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ROLE_DASHBOARD_PATHS = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
} as const;

export async function requireParentContext() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to initialize the parent dashboard connection:', error);
    return { error: 'connection' as const };
  }

  let authResult;
  try {
    authResult = await supabase.auth.getUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to verify the parent dashboard session:', error);
    return { error: 'authentication' as const };
  }

  if (authResult.error) {
    console.error('Unable to verify the parent dashboard session:', authResult.error);
    return { error: 'authentication' as const };
  }

  const user = authResult.data.user;
  if (!user) {
    redirect('/login?redirectedFrom=/dashboard/parent');
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
    console.error('Unable to load the parent dashboard profile:', error);
    return { error: 'profile' as const };
  }

  if (profileResult.error) {
    console.error('Unable to load the parent dashboard profile:', profileResult.error);
    return { error: 'profile' as const };
  }
  if (!profileResult.data) {
    redirect('/login?error=profile_not_found');
  }

  const profile = profileResult.data;
  if (profile.role !== 'parent') {
    redirect(ROLE_DASHBOARD_PATHS[profile.role]);
  }

  return {
    supabase,
    userId: user.id,
    profile,
    schoolId: profile.school_id,
  };
}

export type ParentContext = Extract<
  Awaited<ReturnType<typeof requireParentContext>>,
  { supabase: unknown }
>;

export type ParentChild = {
  id: string;
  full_name: string;
  admission_number: string | null;
  enrollment_date: string | null;
  class_id: string | null;
  class_name: string | null;
};

export async function loadParentChildren(context: ParentContext): Promise<ParentChild[]> {
  const { supabase, userId, schoolId } = context;
  if (!schoolId) return [];

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, admission_number, enrollment_date, parent_id')
    .eq('parent_id', userId)
    .eq('school_id', schoolId);
  if (studentsError) throw studentsError;
  if (!students?.length) return [];

  const studentIds = students.map((student) => student.id);
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select('student_id, class_id, enrollment_date')
    .in('student_id', studentIds)
    .eq('status', 'active')
    .order('enrollment_date', { ascending: false, nullsFirst: false });
  if (enrollmentError) throw enrollmentError;

  const classIdByStudent = new Map<string, string>();
  for (const enrollment of enrollments ?? []) {
    if (!classIdByStudent.has(enrollment.student_id)) {
      classIdByStudent.set(enrollment.student_id, enrollment.class_id);
    }
  }
  const classIds = [...new Set(classIdByStudent.values())];
  const [profileResult, classResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, school_id, role')
      .in('id', studentIds)
      .eq('school_id', schoolId)
      .eq('role', 'student'),
    classIds.length
      ? supabase
          .from('classes')
          .select('id, name, school_id')
          .in('id', classIds)
          .eq('school_id', schoolId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (classResult.error) throw classResult.error;

  const profileById = new Map(
    (profileResult.data ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const classById = new Map(
    (classResult.data ?? []).map((classroom) => [classroom.id, classroom.name]),
  );

  return students.flatMap((student) => {
    const fullName = profileById.get(student.id);
    if (!fullName) return [];
    const classId = classIdByStudent.get(student.id) ?? null;
    return [{
      id: student.id,
      full_name: fullName,
      admission_number: student.admission_number,
      enrollment_date: student.enrollment_date,
      class_id: classId,
      class_name: classId ? classById.get(classId) ?? null : null,
    }];
  });
}

export function formatParentDate(value: string | null) {
  if (!value) return 'Not specified';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatParentCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(value);
}
