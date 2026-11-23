import { Users, UserCheck, UserX } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Students" description="Review student enrollment records for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().toLowerCase() ?? '';

  return renderAdminPageSafely('students', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Students" description="Review student enrollment records for your school." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so student records cannot be loaded." />
        </div>
      );
    }

    let studentsQuery = supabase
      .from('students')
      .select('id, admission_number, enrollment_date, status, school_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (role === 'admin' && schoolId) studentsQuery = studentsQuery.eq('school_id', schoolId);

    const { data: students, error: studentsError } = await studentsQuery;
    if (studentsError) throw studentsError;

    const studentIds = (students ?? []).map((student) => student.id);
    let profiles: Array<{ id: string; full_name: string | null }> = [];
    if (studentIds.length > 0) {
      let profileQuery = supabase
        .from('profiles')
        .select('id, full_name, school_id')
        .in('id', studentIds);
      if (role === 'admin' && schoolId) profileQuery = profileQuery.eq('school_id', schoolId);

      const { data, error } = await profileQuery;
      if (error) throw error;
      profiles = data ?? [];
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
    const rows = (students ?? []).map((student) => ({
      ...student,
      full_name: profileById.get(student.id) ?? null,
    }));
    const filteredRows = rows.filter((student) =>
      `${student.full_name ?? ''} ${student.admission_number ?? ''}`.toLowerCase().includes(query),
    );
    const activeCount = rows.filter((student) => student.status === 'active').length;
    const inactiveCount = rows.length - activeCount;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Students" description="Review and search student enrollment records scoped to your authorized school." />
        <section aria-label="Student summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Loaded students" value={String(rows.length)} detail="Most recent records (up to 500)" icon={Users} />
          <AdminStatCard label="Active" value={String(activeCount)} detail="Among loaded records" icon={UserCheck} />
          <AdminStatCard label="Other statuses" value={String(inactiveCount)} detail="Among loaded records" icon={UserX} />
        </section>
        <AdminPanel title="Student directory" description="Names come from the related profiles table; search by name or admission number.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="student-query" className="sr-only">Search students</label>
            <input id="student-query" name="q" type="search" defaultValue={query} placeholder="Search name or admission number" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">Search</button>
          </form>
          {!rows.length ? (
            <AdminEmptyState title="No student records" description="Student records will appear here after they are added to the database." />
          ) : !filteredRows.length ? (
            <AdminEmptyState title="No matching students" description="Try a different name or admission number." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Student</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Admission number</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Enrolled</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredRows.map((student) => (
                    <tr key={student.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{student.full_name ?? 'Profile unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{student.admission_number ?? 'Not provided'}</td>
                      <td className="py-3 pr-4 text-gray-300">{student.enrollment_date ?? 'Not specified'}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{student.status ?? 'Unknown'}</span></td>
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
