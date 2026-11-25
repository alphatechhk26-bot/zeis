import { Users, UserCheck, UserX } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { StudentsManager } from '@/components/dashboard/students-manager';
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
        <AdminPageHeader title="Students" description="Manage student and class enrollment records for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().toLowerCase() ?? '';

  return renderAdminPageSafely('students', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Students" description="Manage student and class enrollment records for your school." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing students." />
        </div>
      );
    }

    const [studentResult, classResult, yearResult, streamResult] = await Promise.all([
      supabase
        .from('students')
        .select('id, admission_number, enrollment_date, status, school_id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('classes').select('id, name, school_id').eq('school_id', schoolId).order('name'),
      supabase
        .from('academic_years')
        .select('id, name, school_id, start_date, end_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
      supabase.from('streams').select('id, name, school_id').eq('school_id', schoolId).order('name'),
    ]);
    if (studentResult.error) throw studentResult.error;
    if (classResult.error) throw classResult.error;
    if (yearResult.error) throw yearResult.error;
    if (streamResult.error) throw streamResult.error;

    const students = studentResult.data ?? [];
    const studentIds = students.map((row) => row.id);
    const { data: profiles, error: profileError } = studentIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', studentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const { data: rawEnrollments, error: enrollmentError } = studentIds.length
      ? await supabase
          .from('student_enrollments')
          .select('id, student_id, class_id, academic_year_id, term_id, stream_id, enrollment_date, status, created_at')
          .in('student_id', studentIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (enrollmentError) throw enrollmentError;

    const enrollmentRows = rawEnrollments ?? [];
    const termIds = [...new Set(enrollmentRows.flatMap((row) => row.term_id ? [row.term_id] : []))];
    const { data: termRows, error: termError } = termIds.length
      ? await supabase
          .from('terms')
          .select('id, academic_year_id, name, start_date, end_date')
          .in('id', termIds)
      : { data: [], error: null };
    if (termError) throw termError;

    const classById = new Map((classResult.data ?? []).map((row) => [row.id, row.name]));
    const yearById = new Map((yearResult.data ?? []).map((row) => [row.id, row.name]));
    const termById = new Map((termRows ?? []).map((row) => [row.id, row]));
    const streamById = new Map((streamResult.data ?? []).map((row) => [row.id, row.name]));
    const nameById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]));
    const latestEnrollmentByStudent = new Map<string, (typeof enrollmentRows)[number]>();
    for (const enrollment of enrollmentRows) {
      if (latestEnrollmentByStudent.has(enrollment.student_id)) continue;
      const term = enrollment.term_id ? termById.get(enrollment.term_id) : null;
      const isValid =
        classById.has(enrollment.class_id) &&
        yearById.has(enrollment.academic_year_id) &&
        (!enrollment.term_id || term?.academic_year_id === enrollment.academic_year_id) &&
        (!enrollment.stream_id || streamById.has(enrollment.stream_id));
      if (isValid) latestEnrollmentByStudent.set(enrollment.student_id, enrollment);
    }

    const rows = students.map((student) => {
      const enrollment = latestEnrollmentByStudent.get(student.id) ?? null;
      const term = enrollment?.term_id ? termById.get(enrollment.term_id) : null;
      const summary = enrollment
        ? [
            classById.get(enrollment.class_id),
            yearById.get(enrollment.academic_year_id),
            term?.name,
            enrollment.stream_id ? streamById.get(enrollment.stream_id) : null,
          ].filter(Boolean).join(' · ')
        : 'No valid class enrollment';
      return {
        ...student,
        full_name: nameById.get(student.id) ?? null,
        enrollment,
        enrollment_summary: summary,
      };
    });
    const filteredRows = rows.filter((student) =>
      `${student.full_name ?? ''} ${student.admission_number ?? ''}`.toLowerCase().includes(query)
    );
    const activeCount = rows.filter((student) => student.status === 'active').length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Students" description="Manage student accounts and class enrollments within your authenticated school." />
        <section aria-label="Student summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Loaded students" value={String(rows.length)} detail="Most recent records (up to 500)" icon={Users} />
          <AdminStatCard label="Active" value={String(activeCount)} detail="Among loaded records" icon={UserCheck} />
          <AdminStatCard label="Other statuses" value={String(rows.length - activeCount)} detail="Among loaded records" icon={UserX} />
        </section>
        <AdminPanel title="Student directory" description="Names and enrollment details are loaded only from records belonging to this school.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="student-query" className="sr-only">Search students</label>
            <input id="student-query" name="q" type="search" defaultValue={query} placeholder="Search name or admission number" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">Search</button>
          </form>
          {!rows.length ? (
            <AdminEmptyState title="No student records" description="Create a student account to add an initial class enrollment." />
          ) : !filteredRows.length ? (
            <AdminEmptyState title="No matching students" description="Try a different name or admission number." />
          ) : null}
          <StudentsManager
            initialStudents={filteredRows}
            classes={(classResult.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
            academicYears={(yearResult.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
            terms={(termRows ?? []).map((row) => ({
              id: row.id,
              label: row.name,
              academic_year_id: row.academic_year_id,
              start_date: row.start_date,
              end_date: row.end_date,
            }))}
            streams={(streamResult.data ?? []).map((row) => ({ id: row.id, label: row.name }))}
          />
        </AdminPanel>
      </div>
    );
  });
}
