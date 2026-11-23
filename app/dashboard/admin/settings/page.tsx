import { Settings2, School, ShieldCheck } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminDate,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminSettingsPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Settings" description="Review available school or platform configuration." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('settings', async () => {
    if (role === 'admin') {
      if (!schoolId) {
        return (
          <div className="space-y-6">
            <AdminPageHeader title="Settings" description="Review available school configuration." />
            <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school." />
          </div>
        );
      }

      const { data: school, error } = await supabase
        .from('schools')
        .select('id, name, slug, is_active, updated_at')
        .eq('id', schoolId)
        .maybeSingle();
      if (error) throw error;

      return (
        <div className="space-y-6">
          <AdminPageHeader title="Settings" description="Review your school identity and available configuration." />
          {!school ? (
            <AdminEmptyState title="School record unavailable" description="The school associated with your admin profile could not be found." />
          ) : (
            <AdminPanel title="School profile" description="Read-only information from the schools table.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs uppercase tracking-wide text-gray-500">School</dt><dd className="mt-1 text-sm text-gray-100">{school.name}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-500">Slug</dt><dd className="mt-1 text-sm text-gray-100">{school.slug}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-100">{school.is_active ? 'Active' : 'Inactive'}</dd></div>
                <div><dt className="text-xs uppercase tracking-wide text-gray-500">Last updated</dt><dd className="mt-1 text-sm text-gray-100">{formatAdminDate(school.updated_at)}</dd></div>
              </dl>
              <p className="mt-5 border-t border-gray-800 pt-4 text-sm leading-6 text-gray-400">
                The generated database types do not define school-specific settings fields. No settings have been inferred or changed.
              </p>
            </AdminPanel>
          )}
        </div>
      );
    }

    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('id, default_term, email_notifications_enabled, maintenance_mode, updated_at')
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Settings" description="Review global platform configuration. Secret SMTP credentials are never fetched or displayed here." />
        {!settings ? (
          <AdminEmptyState title="No system settings found" description="No system_settings record is available in the current database." />
        ) : (
          <>
            <section aria-label="System configuration summary" className="grid gap-4 sm:grid-cols-3">
              <AdminStatCard label="Default term" value={settings.default_term} detail="Configured system default" icon={Settings2} />
              <AdminStatCard label="Email notifications" value={settings.email_notifications_enabled ? 'Enabled' : 'Disabled'} detail="Global configuration" icon={ShieldCheck} />
              <AdminStatCard label="Maintenance mode" value={settings.maintenance_mode ? 'On' : 'Off'} detail="Global configuration" icon={School} />
            </section>
            <AdminPanel title="System configuration" description="Read-only values from system_settings.">
              <p className="text-sm text-gray-400">Last updated {formatAdminDate(settings.updated_at)}. SMTP host, username, and password are excluded from this query.</p>
            </AdminPanel>
          </>
        )}
      </div>
    );
  });
}
