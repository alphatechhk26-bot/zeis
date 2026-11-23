import { redirect, unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const ROLE_DASHBOARD_PATHS = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
} as const;

export async function requireAdminContext() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to initialize the admin dashboard connection:', error);
    return { error: 'connection' as const };
  }

  let authResult;
  try {
    authResult = await supabase.auth.getUser();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to verify the admin dashboard session:', error);
    return { error: 'authentication' as const };
  }

  if (authResult.error) {
    console.error('Unable to verify the admin dashboard session:', authResult.error);
    return { error: 'authentication' as const };
  }

  const user = authResult.data.user;
  if (!user) {
    redirect('/login?redirectedFrom=/dashboard/admin');
  }

  let profileResult;
  try {
    profileResult = await supabase
      .from('profiles')
      .select('id, role, school_id')
      .eq('id', user.id)
      .maybeSingle();
  } catch (error) {
    unstable_rethrow(error);
    console.error('Unable to load the admin dashboard profile:', error);
    return { error: 'profile' as const };
  }

  if (profileResult.error) {
    console.error('Unable to load the admin dashboard profile:', profileResult.error);
    return { error: 'profile' as const };
  }
  if (!profileResult.data) {
    redirect('/login?error=profile_not_found');
  }

  const profile = profileResult.data;
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    redirect(ROLE_DASHBOARD_PATHS[profile.role]);
  }

  return {
    supabase,
    userId: user.id,
    role: profile.role,
    schoolId: profile.school_id,
  };
}
