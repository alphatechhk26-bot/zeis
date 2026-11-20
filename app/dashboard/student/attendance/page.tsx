import { CalendarDays } from 'lucide-react';
import { formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';
import {
  StudentEmptyState,
  StudentPageHeader,
  StudentPanel,
  StudentStatCard,
} from '@/components/dashboard/student-ui';

export default async function StudentAttendancePage() {
  const { supabase, studentId } = await requireStudentContext();
  const { data: records, error } = await supabase
    .from('attendance')
    .select('id, attendance_date, status, remarks')
    .eq('student_id', studentId)
    .order('attendance_date', { ascending: false });

  if (error) throw new Error(`Unable to load your attendance records: ${error.message}`);

  const attendanceRecords = records ?? [];
  const total = attendanceRecords.length;
  const present = attendanceRecords.filter((record) => record.status === 'present').length;
  const late = attendanceRecords.filter((record) => record.status === 'late').length;
  const absent = attendanceRecords.filter((record) => record.status === 'absent').length;
  const excused = attendanceRecords.filter((record) => record.status === 'excused').length;
  const attendancePercentage = total ? Math.round(((present + late) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Attendance" description="Review your recorded attendance and current attendance summary." />
      <section aria-label="Attendance summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StudentStatCard label="Attendance rate" value={`${attendancePercentage}%`} detail={`${total} recorded days`} icon={CalendarDays} />
        <StudentStatCard label="Present" value={String(present)} detail="Marked present" icon={CalendarDays} />
        <StudentStatCard label="Late" value={String(late)} detail="Marked late" icon={CalendarDays} />
        <StudentStatCard label="Absent / excused" value={`${absent} / ${excused}`} detail="Recorded absences" icon={CalendarDays} />
      </section>
      <StudentPanel title="Attendance history" description="Most recent records appear first.">
        {!attendanceRecords.length ? (
          <StudentEmptyState
            title="No attendance records yet"
            description="Attendance will appear here after it has been recorded by your school."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Status</th>
                  <th scope="col" className="pb-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="py-3 pr-4 text-gray-200">{formatStudentDate(record.attendance_date)}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{record.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StudentPanel>
    </div>
  );
}
