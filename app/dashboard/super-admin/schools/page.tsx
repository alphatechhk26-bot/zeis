// app/dashboard/super-admin/schools/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SchoolsTable } from "@/components/super-admin/schools-table";
import { BuildingOfficeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export const dynamic = 'force-dynamic';

export default async function SchoolsManagementPage() {
  const supabase = await createClient();

  // 1. RBAC Check (Defense in depth)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirectedFrom=/dashboard/super-admin/schools');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || caller.role !== 'super_admin') {
    redirect('/dashboard');
  }

  // 2. Fetch Schools
  const { data: schools, error } = await supabase
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load schools: ${error.message}`);
  }

  // 3. Calculate Stats
  const totalSchools = schools?.length || 0;
  const activeSchools = schools?.filter(s => s.is_active).length || 0;
  const suspendedSchools = totalSchools - activeSchools;

  const stats = [
    {
      label: 'Total Schools',
      value: totalSchools,
      icon: BuildingOfficeIcon,
      color: 'text-blue-400',
      border: 'border-blue-500/20',
    },
    {
      label: 'Active Schools',
      value: activeSchools,
      icon: CheckCircleIcon,
      color: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Suspended',
      value: suspendedSchools,
      icon: XCircleIcon,
      color: 'text-red-400',
      border: 'border-red-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Schools Directory</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage platform tenants, update branding, and control access.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`bg-gray-900/60 rounded-xl border p-4 ${stat.border}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">{stat.label}</p>
                <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <SchoolsTable initialSchools={schools || []} />
    </div>
  );
}