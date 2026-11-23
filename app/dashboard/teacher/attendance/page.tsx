import { TeacherEmptyState, TeacherPageHeader, TeacherPanel } from '@/components/dashboard/teacher-ui';
import { formatTeacherDate, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherAttendancePage() {
  const { supabase, teacherId, schoolId } = await requireTeacherContext();

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Attendance" description="Attendance recorded for your assigned classes." />
        <TeacherEmptyState title="School assignment pending" description="Attendance records will appear after a school is assigned to your account." />
      </div>
    );
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('teacher_assignments')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (assignmentError) throw new Error(`Unable to load your assigned classes: ${assignmentError.message}`);

  const classIds = [...new Set((assignments ?? []).map((assignment) => assignment.class_id))];
  const { data: records, error: attendanceError } =
    classIds.length > 0
      ? await supabase
          .from('attendance')
          .select('id, attendance_date, class_id, student_id, status, remarks')
          .eq('school_id', schoolId)
          .in('class_id', classIds)
          .order('attendance_date', { ascending: false })
          .limit(500)
      : { data: [], error: null };
  if (attendanceError) throw new Error(`Unable to load attendance for your classes: ${attendanceError.message}`);

  const studentIds = [...new Set((records ?? []).map((record) => record.student_id))];
  const [classResult, studentResult] =
    records?.length
      ? await Promise.all([
          supabase.from('classes').select('id, name').eq('school_id', schoolId).in('id', classIds),
          supabase.from('students').select('id, admission_number').eq('school_id', schoolId).in('id', studentIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (classResult.error) throw new Error(`Unable to load attendance class details: ${classResult.error.message}`);
  if (studentResult.error) throw new Error(`Unable to load attendance student details: ${studentResult.error.message}`);

  const classById = new Map((classResult.data ?? []).map((classroom) => [classroom.id, classroom.name]));
  const studentById = new Map((studentResult.data ?? []).map((student) => [student.id, student.admission_number]));

  return (
    <div className="space-y-6">
      <TeacherPageHeader title="Attendance" description="Review recorded attendance for your assigned classes." />
      <TeacherPanel title="Recent attendance" description="Up to 500 most recent records; no attendance is inferred or fabricated.">
        {!records?.length ? (
          <TeacherEmptyState title={classIds.length ? 'No attendance records' : 'No classes assigned'} description={classIds.length ? 'Attendance will appear after it is recorded for one of your classes.' : 'Attendance records will appear after classes are assigned to you.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
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
                    <td className="py-3 pr-4 text-gray-200">{formatTeacherDate(record.attendance_date)}</td>
                    <td className="py-3 pr-4 text-gray-300">{classById.get(record.class_id) ?? 'Class unavailable'}</td>
                    <td className="py-3 pr-4 text-gray-300">{studentById.get(record.student_id) ?? 'Not provided'}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs capitalize text-gray-200">{record.status}</span>
                    </td>
                    <td className="py-3 text-gray-400">{record.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TeacherPanel>
    </div>
  );
}
