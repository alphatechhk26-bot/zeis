import { CalendarDays, CircleCheck, CircleX } from 'lucide-react';
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

export default async function AdminAttendancePage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Attendance" description="Review recorded attendance for your authorized school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('attendance', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Attendance" description="Review recorded attendance for your authorized school." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so attendance records cannot be loaded." />
        </div>
      );
    }

    let attendanceQuery = supabase
      .from('attendance')
      .select('id, attendance_date, class_id, student_id, status, remarks, school_id')
      .order('attendance_date', { ascending: false })
      .limit(500);
    if (role === 'admin' && schoolId) attendanceQuery = attendanceQuery.eq('school_id', schoolId);

    const { data: records, error: attendanceError } = await attendanceQuery;
    if (attendanceError) throw attendanceError;

    const classIds = [...new Set((records ?? []).map((record) => record.class_id))];
    const studentIds = [...new Set((records ?? []).map((record) => record.student_id))];
    let classes: Array<{ id: string; name: string }> = [];
    let students: Array<{ id: string; admission_number: string | null }> = [];

    if (classIds.length > 0) {
      let classQuery = supabase.from('classes').select('id, name').in('id', classIds);
      if (role === 'admin' && schoolId) classQuery = classQuery.eq('school_id', schoolId);
      const { data, error } = await classQuery;
      if (error) throw error;
      classes = data ?? [];
    }
    if (studentIds.length > 0) {
      let studentQuery = supabase.from('students').select('id, admission_number, school_id').in('id', studentIds);
      if (role === 'admin' && schoolId) studentQuery = studentQuery.eq('school_id', schoolId);
      const { data, error } = await studentQuery;
      if (error) throw error;
      students = data ?? [];
    }

    const classById = new Map(classes.map((classroom) => [classroom.id, classroom.name]));
    const studentById = new Map(students.map((student) => [student.id, student.admission_number]));
    const present = (records ?? []).filter((record) => record.status === 'present').length;
    const absent = (records ?? []).filter((record) => record.status === 'absent').length;
    const late = (records ?? []).filter((record) => record.status === 'late').length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Attendance" description="Review actual attendance records within your authorized school scope." />
        <section aria-label="Attendance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Loaded records" value={String(records?.length ?? 0)} detail="Most recent records (up to 500)" icon={CalendarDays} />
          <AdminStatCard label="Present" value={String(present)} detail="In loaded records" icon={CircleCheck} />
          <AdminStatCard label="Absent" value={String(absent)} detail="In loaded records" icon={CircleX} />
          <AdminStatCard label="Late" value={String(late)} detail="In loaded records" icon={CalendarDays} />
        </section>
        <AdminPanel title="Attendance history" description="Only stored attendance records are shown.">
          {!records?.length ? (
            <AdminEmptyState title="No attendance records" description="Attendance will appear here after it has been recorded." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Admission number</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Status</th>
                    <th scope="col" className="pb-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="py-3 pr-4 text-gray-200">{formatAdminDate(record.attendance_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{classById.get(record.class_id) ?? 'Class unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{studentById.get(record.student_id) ?? 'Not provided'}</td>
                      <td className="py-3 pr-4"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{record.status}</span></td>
                      <td className="py-3 text-gray-400">{record.remarks ?? '—'}</td>
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
