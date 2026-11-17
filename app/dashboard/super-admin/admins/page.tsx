// app/dashboard/super-admin/admins/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminsTable, type AdminRow } from '@/components/super-admin/admins-table';
import { UserGroupIcon, ShieldCheckIcon, BuildingOfficeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Force dynamic because we read session cookies on every request
export const dynamic = 'force-dynamic';

export default async function AdminsManagementPage() {
  // -------------------------------------------------------------------------
  // 1. Server-side RBAC (defense in depth — middleware also guards this route)
  // -------------------------------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectedFrom=/dashboard/super-admin/admins');
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'super_admin') {
    const map: Record<string, string> = {
      admin: '/dashboard/admin',
      teacher: '/dashboard/teacher',
      student: '/dashboard/student',
      parent: '/dashboard/parent',
    };
    redirect(caller ? map[caller.role] ?? '/dashboard' : '/login');
  }

  // -------------------------------------------------------------------------
  // 2. Fetch admin profiles + their school
  // -------------------------------------------------------------------------
  const { data: profileRows, error: profilesError } = await supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      role,
      school_id,
      created_at,
      schools:school_id ( id, name, slug, is_active )
    `
    )
    .in('role', ['admin', 'super_admin'])
    .order('role', { ascending: true })
    .order('created_at', { ascending: false });

  if (profilesError) {
    throw new Error(`Failed to load administrators: ${profilesError.message}`);
  }

  // -------------------------------------------------------------------------
  // 3. Fetch emails from auth.users via service-role client (parallel)
  // -------------------------------------------------------------------------
  const adminClient = createAdminClient();
  const ids = (profileRows ?? []).map((p) => p.id);

  const emailResults = await Promise.all(
    ids.map((id) => adminClient.auth.admin.getUserById(id).then((r) => [id, r.data.user?.email ?? null] as const))
  );
  const emailMap = new Map<string, string | null>(emailResults);

  // -------------------------------------------------------------------------
  // 4. Fetch all schools (for the dropdown)
  // -------------------------------------------------------------------------
  const { data: schoolRows } = await supabase
    .from('schools')
    .select('id, name, slug')
    .order('name');

  // -------------------------------------------------------------------------
  // 5. Shape rows for the table
  // -------------------------------------------------------------------------
  const admins: AdminRow[] = (profileRows ?? []).map((p) => {
    const school = Array.isArray(p.schools) ? p.schools[0] : p.schools;
    return {
      id: p.id,
      full_name: p.full_name,
      email: emailMap.get(p.id) ?? null,
      role: p.role,
      school_id: p.school_id,
      school_name: school?.name ?? null,
      school_slug: school?.slug ?? null,
      school_active: school?.is_active ?? null,
      created_at: p.created_at,
    };
  });

  // -------------------------------------------------------------------------
  // 6. Stats
  // -------------------------------------------------------------------------
  const totalAdmins = admins.length;
  const superAdmins = admins.filter((a) => a.role === 'super_admin').length;
  const assignedAdmins = admins.filter(
    (a) => a.role === 'admin' && a.school_id !== null
  ).length;
  const unassignedAdmins = admins.filter(
    (a) => a.role === 'admin' && a.school_id === null
  ).length;

  const stats = [
    {
      label: 'Total Administrators',
      value: totalAdmins,
      icon: UserGroupIcon,
      accent: 'text-blue-400',
      glow: 'shadow-[0_0_18px_rgba(59,130,246,0.25)]',
      border: 'border-blue-500/20',
    },
    {
      label: 'Super Admins',
      value: superAdmins,
      icon: ShieldCheckIcon,
      accent: 'text-emerald-400',
      glow: 'shadow-[0_0_18px_rgba(16,185,129,0.25)]',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Assigned to Schools',
      value: assignedAdmins,
      icon: BuildingOfficeIcon,
      accent: 'text-purple-400',
      glow: 'shadow-[0_0_18px_rgba(168,85,247,0.25)]',
      border: 'border-purple-500/20',
    },
    {
      label: 'Unassigned',
      value: unassignedAdmins,
      icon: ExclamationTriangleIcon,
      accent: 'text-amber-400',
      glow: 'shadow-[0_0_18px_rgba(245,158,11,0.25)]',
      border: 'border-amber-500/20',
    },
  ];

  // -------------------------------------------------------------------------
  // 7. Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Administrators</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage roles and school assignments across the platform.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border bg-gray-900/60 p-4 ${stat.border} ${stat.glow}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">
                  {stat.label}
                </div>
                <div className={`mt-2 text-3xl font-bold ${stat.accent}`}>
                  {stat.value}
                </div>
              </div>
              <stat.icon className={`h-5 w-5 ${stat.accent}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <AdminsTable
        admins={admins}
        schools={schoolRows ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}