import 'server-only';

import { createClient } from '@/lib/supabase/server';

export async function requireAdminSchoolContext() {
  const db = await createClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError || !user) throw new Error('Unauthorized: please sign in.');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw new Error(`Could not verify your administrator profile: ${profileError.message}`);
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    throw new Error('Forbidden: school administrator access is required.');
  }
  if (!profile.school_id) {
    throw new Error('Your administrator profile must be assigned to a school.');
  }

  const { data: school, error: schoolError } = await db
    .from('schools')
    .select('id')
    .eq('id', profile.school_id)
    .maybeSingle();

  if (schoolError) throw new Error(`Could not verify your school: ${schoolError.message}`);
  if (!school) throw new Error('Your assigned school could not be verified.');

  return { db, userId: user.id, schoolId: school.id };
}
