import { GraduationCap, UserCheck, UserX } from 'lucide-react';
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

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Teachers" description="Review teaching staff records for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().toLowerCase() ?? '';

  return renderAdminPageSafely('teachers', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Teachers" description="Review teaching staff records for your school." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so teacher records cannot be loaded." />
        </div>
      );
    }

    let teachersQuery = supabase
      .from('teachers')
      .select('id, employee_id, hire_date, status, school_id')
      .order('created_at', { ascending: false })
      .limit(500);
    if (role === 'admin' && schoolId) teachersQuery = teachersQuery.eq('school_id', schoolId);

    const { data: teachers, error: teacherError } = await teachersQuery;
    if (teacherError) throw teacherError;

    const teacherIds = (teachers ?? []).map((teacher) => teacher.id);
    let profiles: Array<{ id: string; full_name: string | null }> = [];
    if (teacherIds.length > 0) {
      let profileQuery = supabase.from('profiles').select('id, full_name, school_id').in('id', teacherIds);
      if (role === 'admin' && schoolId) profileQuery = profileQuery.eq('school_id', schoolId);

      const { data, error } = await profileQuery;
      if (error) throw error;
      profiles = data ?? [];
    }

    const nameById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
    const rows = (teachers ?? []).map((teacher) => ({
      ...teacher,
      full_name: nameById.get(teacher.id) ?? null,
    }));
    const filteredRows = rows.filter((teacher) =>
      `${teacher.full_name ?? ''} ${teacher.employee_id ?? ''}`.toLowerCase().includes(query),
    );
    const activeCount = rows.filter((teacher) => teacher.status === 'active').length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Teachers" description="Review and search teaching staff records scoped to your authorized school." />
        <section aria-label="Teacher summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Loaded teachers" value={String(rows.length)} detail="Most recent records (up to 500)" icon={GraduationCap} />
          <AdminStatCard label="Active" value={String(activeCount)} detail="Among loaded records" icon={UserCheck} />
          <AdminStatCard label="Other statuses" value={String(rows.length - activeCount)} detail="Among loaded records" icon={UserX} />
        </section>
        <AdminPanel title="Teacher directory" description="Search by teacher name or employee identifier.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="teacher-query" className="sr-only">Search teachers</label>
            <input id="teacher-query" name="q" type="search" defaultValue={query} placeholder="Search name or employee ID" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">Search</button>
          </form>
          {!rows.length ? (
            <AdminEmptyState title="No teacher records" description="Teacher records will appear here after they are added to the database." />
          ) : !filteredRows.length ? (
            <AdminEmptyState title="No matching teachers" description="Try a different name or employee identifier." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Teacher</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Employee ID</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Hire date</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredRows.map((teacher) => (
                    <tr key={teacher.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{teacher.full_name ?? 'Profile unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{teacher.employee_id ?? 'Not provided'}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(teacher.hire_date)}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{teacher.status ?? 'Unknown'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminPanel>
      </div>
    );
  });
}
