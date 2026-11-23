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

  return { supabase, teacherId: user.id, profile, schoolId: profile.school_id };
}

export function formatTeacherDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
