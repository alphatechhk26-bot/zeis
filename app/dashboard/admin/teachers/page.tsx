import { GraduationCap, UserCheck, UserX } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { TeachersManager } from '@/components/dashboard/teachers-manager';
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
        <AdminPageHeader title="Teachers" description="Manage teaching staff for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().toLowerCase() ?? '';

  return renderAdminPageSafely('teachers', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Teachers" description="Manage teaching staff for your school." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing teachers." />
        </div>
      );
    }

    const { data: teachers, error: teacherError } = await supabase
      .from('teachers')
      .select('id, employee_id, hire_date, status, school_id, created_at, updated_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (teacherError) throw teacherError;

    const teacherIds = (teachers ?? []).map((teacher) => teacher.id);
    const { data: profiles, error: profileError } = teacherIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', teacherIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const { data: rawAssignments, error: assignmentError } = teacherIds.length
      ? await supabase
          .from('teacher_assignments')
          .select('id, teacher_id, class_id, subject_id, academic_year_id')
          .in('teacher_id', teacherIds)
      : { data: [], error: null };
    if (assignmentError) throw assignmentError;

    const assignments = rawAssignments ?? [];
    const classIds = [...new Set(assignments.map((row) => row.class_id))];
    const subjectIds = [...new Set(assignments.map((row) => row.subject_id))];
    const yearIds = [...new Set(assignments.map((row) => row.academic_year_id))];
    const [classesResult, subjectsResult, yearsResult] = await Promise.all([
      classIds.length
        ? supabase.from('classes').select('id, name, school_id').in('id', classIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length
        ? supabase.from('subjects').select('id, name, school_id').in('id', subjectIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
      yearIds.length
        ? supabase.from('academic_years').select('id, name, school_id').in('id', yearIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesResult.error) throw classesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (yearsResult.error) throw yearsResult.error;

    const classById = new Map((classesResult.data ?? []).map((row) => [row.id, row.name]));
    const subjectById = new Map((subjectsResult.data ?? []).map((row) => [row.id, row.name]));
    const yearById = new Map((yearsResult.data ?? []).map((row) => [row.id, row.name]));
    const validTeacherIds = new Set((teachers ?? []).map((row) => row.id));
    const visibleAssignments = assignments
      .filter((row) =>
        validTeacherIds.has(row.teacher_id) &&
        classById.has(row.class_id) &&
        subjectById.has(row.subject_id) &&
        yearById.has(row.academic_year_id)
      )
      .map((row) => ({
        ...row,
        class_name: classById.get(row.class_id)!,
        subject_name: subjectById.get(row.subject_id)!,
        academic_year_name: yearById.get(row.academic_year_id)!,
      }));

    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const rows = (teachers ?? []).map((teacher) => ({
      ...teacher,
      full_name: nameById.get(teacher.id) ?? null,
    }));
    const filteredRows = rows.filter((teacher) =>
      `${teacher.full_name ?? ''} ${teacher.employee_id ?? ''}`.toLowerCase().includes(query)
    );
    const activeCount = rows.filter((teacher) => teacher.status === 'active').length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Teachers" description="Manage teaching staff scoped to your authenticated school." />
        <section aria-label="Teacher summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Loaded teachers" value={String(rows.length)} detail="Most recent records (up to 500)" icon={GraduationCap} />
          <AdminStatCard label="Active" value={String(activeCount)} detail="Among loaded records" icon={UserCheck} />
          <AdminStatCard label="Other statuses" value={String(rows.length - activeCount)} detail="Among loaded records" icon={UserX} />
        </section>
        <AdminPanel title="Teacher directory" description="Create staff accounts, edit teacher records, and review class assignments.">
          <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="teacher-query" className="sr-only">Search teachers</label>
            <input id="teacher-query" name="q" type="search" defaultValue={query} placeholder="Search name or employee ID" className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            <button type="submit" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800">Search</button>
          </form>
          {!rows.length ? (
            <AdminEmptyState title="No teacher records" description="Create a teacher account to start managing staff." />
          ) : !filteredRows.length ? (
            <AdminEmptyState title="No matching teachers" description="Try a different name or employee identifier." />
          ) : null}
          <TeachersManager initialTeachers={filteredRows} initialAssignments={visibleAssignments} />
        </AdminPanel>
      </div>
    );
  });
}
