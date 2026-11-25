import { redirect } from 'next/navigation';
import { getAllPlatformUsers } from '@/actions/super-admin-admins';
import { AdminsTable } from '@/components/super-admin/admins-table';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminsManagementPage() {
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

  if (caller?.role !== 'super_admin') {
    const destinations = {
      admin: '/dashboard/admin',
      teacher: '/dashboard/teacher',
      student: '/dashboard/student',
      parent: '/dashboard/parent',
    } as const;
    redirect(caller ? destinations[caller.role] ?? '/dashboard' : '/login');
  }

  const result = await getAllPlatformUsers();
  if (!result.success) {
    throw new Error(`Failed to load platform users: ${result.error}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Platform Users</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage user accounts, access roles, and school assignments across the platform.
        </p>
      </div>
      <AdminsTable
        admins={result.data.users}
        schools={result.data.schools}
        currentUserId={user.id}
      />
    </div>
  );
}
