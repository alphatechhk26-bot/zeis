import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentLauncher from '@/components/ai/AgentLauncher';

export default async function AgentPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login?redirectedFrom=%2Fagent');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) redirect('/login?error=profile_not_found');

  const mode = ['admin', 'super_admin', 'teacher'].includes(profile.role) ? 'teacher' : 'student';
  return <AgentLauncher available={Boolean(profile.school_id)} mode={mode} />;
}
