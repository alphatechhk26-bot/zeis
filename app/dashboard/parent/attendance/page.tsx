import { CalendarDays, CircleCheck, CircleX } from 'lucide-react';
import {
  ParentEmptyState,
  ParentErrorState,
  ParentPageHeader,
  ParentPanel,
  ParentStatCard,
  renderParentPageSafely,
} from '@/components/dashboard/parent-ui';
import {
  formatParentDate,
  loadParentChildren,
  requireParentContext,
} from '@/lib/parent-dashboard';

export default async function ParentAttendancePage() {
  const context = await requireParentContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <ParentPageHeader title="Attendance" description="Review attendance records for your linked children." />
        <ParentErrorState />
      </div>
    );
  }

  return renderParentPageSafely('attendance', async () => {
    if (!context.schoolId) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Attendance" description="Review attendance records for your linked children." />
          <ParentEmptyState title="School assignment required" description="Your parent profile is not assigned to a school." />
        </div>
      );
    }

    const children = await loadParentChildren(context);
    if (!children.length) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Attendance" description="Review attendance records for your linked children." />
          <ParentEmptyState title="No linked children found" description="Attendance records are available only for children linked to your account." />
        </div>
      );
    }

    const childIds = children.map((child) => child.id);
    const attendanceResult = await context.supabase
      .from('attendance')
      .select('id, student_id, attendance_date, status, remarks')
      .in('student_id', childIds)
      .order('attendance_date', { ascending: false })
      .limit(1000);

    if (attendanceResult.error) throw attendanceResult.error;
    const attendanceRows = (attendanceResult.data ?? []).map((record) => ({
      id: record.id,
      student_id: record.student_id,
      date: record.attendance_date,
      status: record.status,
      remarks: record.remarks,
    }));

    const childById = new Map(children.map((child) => [child.id, child.full_name]));
    const present = attendanceRows.filter((record) => record.status === 'present').length;
    const absent = attendanceRows.filter((record) => record.status === 'absent').length;
    const late = attendanceRows.filter((record) => record.status === 'late').length;
    const rate = attendanceRows.length
      ? Math.round(((present + late) / attendanceRows.length) * 100)
      : 0;

    return (
      <div className="space-y-6">
        <ParentPageHeader title="Attendance" description="Recorded attendance for children linked to your parent account." />
        <section aria-label="Attendance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ParentStatCard label="Attendance rate" value={`${rate}%`} detail={`${attendanceRows.length} loaded records`} icon={CalendarDays} />
          <ParentStatCard label="Present" value={String(present)} detail="In loaded records" icon={CircleCheck} />
          <ParentStatCard label="Absent" value={String(absent)} detail="In loaded records" icon={CircleX} />
          <ParentStatCard label="Late" value={String(late)} detail="In loaded records" icon={CalendarDays} />
        </section>
        <ParentPanel title="Attendance history" description="Only records for your verified linked children are shown.">
          {!attendanceRows.length ? (
            <ParentEmptyState title="No attendance records" description="Attendance will appear here after it has been recorded by the school." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Child</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Status</th>
                    <th scope="col" className="pb-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {attendanceRows.map((record) => (
                    <tr key={record.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{childById.get(record.student_id) ?? 'Child unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatParentDate(record.date)}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{record.status}</span>
                      </td>
                      <td className="py-3 text-gray-400">{record.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ParentPanel>
      </div>
    );
  });
}
