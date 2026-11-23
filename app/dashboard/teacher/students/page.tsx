import {
  renderTeacherPageSafely,
  TeacherEmptyState,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { requireTeacherContext } from '@/lib/teacher-dashboard';

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
  const { supabase, teacherId, schoolId } = context;

  return renderTeacherPageSafely('students', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <TeacherPageHeader title="Students" description="Students enrolled in your assigned classes." />
          <TeacherEmptyState title="School assignment pending" description="Students will appear after a school is assigned to your account." />
        </div>
      );
    }

  const { data: assignments, error: assignmentError } = await supabase
    .from('teacher_assignments')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (assignmentError) throw new Error(`Unable to load your assigned classes: ${assignmentError.message}`);

  const classIds = [...new Set((assignments ?? []).map((assignment) => assignment.class_id))];
  const { data: enrollments, error: enrollmentError } =
    classIds.length > 0
      ? await supabase
          .from('student_enrollments')
          .select('class_id, student_id, academic_year_id')
          .in('class_id', classIds)
          .eq('status', 'active')
      : { data: [], error: null };
  if (enrollmentError) throw new Error(`Unable to load class enrollments: ${enrollmentError.message}`);

  const studentIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.student_id))];
  const [studentResult, classResult, yearResult] =
    studentIds.length > 0
      ? await Promise.all([
          supabase.from('students').select('id, admission_number').eq('school_id', schoolId).in('id', studentIds),
          supabase.from('classes').select('id, name').eq('school_id', schoolId).in('id', classIds),
          supabase
            .from('academic_years')
            .select('id, name')
            .eq('school_id', schoolId)
            .in('id', [...new Set((enrollments ?? []).map((enrollment) => enrollment.academic_year_id))]),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (studentResult.error) throw new Error(`Unable to load student records: ${studentResult.error.message}`);
  if (classResult.error) throw new Error(`Unable to load assigned class details: ${classResult.error.message}`);
  if (yearResult.error) throw new Error(`Unable to load academic years: ${yearResult.error.message}`);

  const classById = new Map((classResult.data ?? []).map((classroom) => [classroom.id, classroom.name]));
  const yearById = new Map((yearResult.data ?? []).map((year) => [year.id, year.name]));
  const studentById = new Map((studentResult.data ?? []).map((student) => [student.id, student]));
  const rows = (enrollments ?? [])
    .map((enrollment) => ({
      ...enrollment,
      student: studentById.get(enrollment.student_id),
    }))
    .filter((enrollment) => enrollment.student);
  const filteredRows = rows.filter((enrollment) => {
    if (!search) return true;
    return (
      enrollment.student?.admission_number?.toLowerCase().includes(search) ||
      classById.get(enrollment.class_id)?.toLowerCase().includes(search) ||
      yearById.get(enrollment.academic_year_id)?.toLowerCase().includes(search)
    );
  });

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Students" description="Students enrolled in your assigned classes." />
        <TeacherPanel title="Class roster" description="Only active enrollments in your assigned classes are listed.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="student-search" className="sr-only">Search by admission number, class, or academic year</label>
            <input
              id="student-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search admission number, class, or year"
              className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800">
              Search
            </button>
          </form>
          {!rows.length ? (
            <TeacherEmptyState title="No enrolled students" description="Active student enrollments for your classes will appear here." />
          ) : !filteredRows.length ? (
            <TeacherEmptyState title="No matching students" description="Try a different admission number, class, or academic year." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Admission number</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                    <th scope="col" className="pb-3 font-medium">Academic year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredRows.map((enrollment) => (
                    <tr key={`${enrollment.student_id}:${enrollment.class_id}:${enrollment.academic_year_id}`}>
                      <td className="py-3 pr-4 text-gray-200">{enrollment.student?.admission_number || 'Not provided'}</td>
                      <td className="py-3 pr-4 text-gray-300">{classById.get(enrollment.class_id) ?? 'Class unavailable'}</td>
                      <td className="py-3 text-gray-300">{yearById.get(enrollment.academic_year_id) ?? 'Not specified'}</td>
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
