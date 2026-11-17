// app/dashboard/super-admin/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/zeis";
import { SuperAdminNav } from "@/components/dashboard/super-admin-nav";

type UserRole = Database['public']['Enums']['user_role'];

const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect('/login?redirectedFrom=/dashboard/super-admin');
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
if (!profile) { await supabase.auth.signOut(); redirect('/login?error=profile_not_found'); }
if (profile.role !== 'super_admin') {
  const dashboardMap = { admin: '/dashboard/admin', teacher: '/dashboard/teacher', student: '/dashboard/student', parent: '/dashboard/parent' };
  redirect(dashboardMap[profile.role] || '/dashboard');

  }

  // 4. Render shell with sub-navigation
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Section header */}
      <div className="border-b border-gray-800/60 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
                  Platform Control
                </span>
              </div>
              <h1 className="mt-2 text-2xl lg:text-3xl font-bold text-white">
                Super Admin Console
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage schools, administrators, and platform‑wide configuration.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="px-2 py-1 rounded-md bg-gray-800/60 border border-gray-700">
                Role
              </span>
              <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                super_admin
              </span>
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <SuperAdminNav />
      </div>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}