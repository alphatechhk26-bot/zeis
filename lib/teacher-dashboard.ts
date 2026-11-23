import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ROLE_DASHBOARD_PATHS = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
} as const;

export async function requireTeacherContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?redirectedFrom=/dashboard/teacher');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    redirect('/login?error=profile_not_found');
  }

  if (profile.role !== 'teacher') {
    redirect(ROLE_DASHBOARD_PATHS[profile.role]);
  }

  return { supabase, teacherId: user.id, profile, schoolId: profile.school_id };
}

export function formatTeacherDate(value: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
