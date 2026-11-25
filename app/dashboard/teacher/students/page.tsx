import {
  renderTeacherPageSafely,
  TeacherEmptyState,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const search = q.trim().toLowerCase();
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Students" description="Students enrolled in your assigned classes." />
        <TeacherErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderTeacherPageSafely('students', async () => {
    const assignments = await getTeacherAssignmentOptions(context);
    const classIds = [...new Set(assignments.map((item) => item.classId))];
    const yearIds = [...new Set(assignments.map((item) => item.academicYearId))];
    const allowedClassYears = new Set(assignments.map((item) => `${item.classId}:${item.academicYearId}`));
    const { data: enrollments, error: enrollmentError } = classIds.length
      ? await supabase.from('student_enrollments')
          .select('class_id, student_id, academic_year_id')
          .in('class_id', classIds)
          .in('academic_year_id', yearIds)
          .eq('status', 'active')
      : { data: [], error: null };
    if (enrollmentError) throw new Error(`Unable to load class enrollments: ${enrollmentError.message}`);

    const scopedEnrollments = (enrollments ?? []).filter((row) =>
      allowedClassYears.has(`${row.class_id}:${row.academic_year_id}`)
    );
    const studentIds = [...new Set(scopedEnrollments.map((row) => row.student_id))];
    const [studentsResult, profilesResult] = studentIds.length
      ? await Promise.all([
          supabase.from('students').select('id, admission_number').eq('school_id', schoolId).in('id', studentIds),
          supabase.from('profiles').select('id, full_name').eq('school_id', schoolId).in('id', studentIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (studentsResult.error) throw new Error(`Unable to load student records: ${studentsResult.error.message}`);
    if (profilesResult.error) throw new Error(`Unable to load student names: ${profilesResult.error.message}`);

    const classNames = new Map(assignments.map((item) => [item.classId, item.className]));
    const yearNames = new Map(assignments.map((item) => [item.academicYearId, item.academicYearName]));
    const students = new Map((studentsResult.data ?? []).map((student) => [student.id, student]));
    const names = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]));
    const rows = scopedEnrollments.flatMap((enrollment) => {
      const student = students.get(enrollment.student_id);
      if (!student) return [];
      return [{
        ...enrollment,
        student,
        fullName: names.get(student.id) ?? 'Student',
      }];
    });
    const filteredRows = rows.filter((row) => {
      if (!search) return true;
      return (
        row.fullName.toLowerCase().includes(search) ||
        row.student.admission_number?.toLowerCase().includes(search) ||
        classNames.get(row.class_id)?.toLowerCase().includes(search) ||
        yearNames.get(row.academic_year_id)?.toLowerCase().includes(search)
      );
    });

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Students" description="Students enrolled in your assigned classes." />
        <TeacherPanel title="Class roster" description="Only active enrollments in your verified class-subject assignments are listed.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="student-search" className="sr-only">Search by name, admission number, class, or academic year</label>
            <input id="student-search" name="q" type="search" defaultValue={q} placeholder="Search name, admission number, class, or year" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800">Search</button>
          </form>
          {!rows.length ? (
            <TeacherEmptyState title="No enrolled students" description="Active student enrollments for your assigned classes will appear here." />
          ) : !filteredRows.length ? (
            <TeacherEmptyState title="No matching students" description="Try a different name, admission number, class, or academic year." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Student</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Admission number</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                    <th scope="col" className="pb-3 font-medium">Academic year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredRows.map((row) => (
                    <tr key={`${row.student_id}:${row.class_id}:${row.academic_year_id}`}>
                      <td className="py-3 pr-4 text-gray-200">{row.fullName}</td>
                      <td className="py-3 pr-4 text-gray-300">{row.student.admission_number || 'Not provided'}</td>
                      <td className="py-3 pr-4 text-gray-300">{classNames.get(row.class_id) ?? 'Class unavailable'}</td>
                      <td className="py-3 text-gray-300">{yearNames.get(row.academic_year_id) ?? 'Not specified'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TeacherPanel>
      </div>
    );
  });
}
