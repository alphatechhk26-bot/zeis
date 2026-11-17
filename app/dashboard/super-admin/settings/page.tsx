// app/dashboard/super-admin/settings/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from "@/components/super-admin/settings-form";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();

  // RBAC Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') redirect('/dashboard');

  // Fetch current settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-white">System Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage global platform configurations, maintenance modes, and SMTP integrations.
        </p>
      </div>

      <SettingsForm initialData={settings} />
    </div>
  );
}