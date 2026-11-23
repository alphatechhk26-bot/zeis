import { BookOpen, Users } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminClassesPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Classes" description="Review classes, active enrollments, and assigned teachers." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('classes', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Classes" description="Review classes, active enrollments, and assigned teachers." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so class records cannot be loaded." />
        </div>
      );
    }

    let classesQuery = supabase
      .from('classes')
      .select('id, name, code, description, school_id, is_active')
      .order('name')
      .limit(500);
    if (role === 'admin' && schoolId) classesQuery = classesQuery.eq('school_id', schoolId);

    const { data: classes, error: classError } = await classesQuery;
    if (classError) throw classError;

    const classIds = (classes ?? []).map((classroom) => classroom.id);
    let assignments: Array<{ class_id: string; teacher_id: string; subject_id: string }> = [];
    let enrollments: Array<{ class_id: string }> = [];
    if (classIds.length > 0) {
      const [assignmentResult, enrollmentResult] = await Promise.all([
        supabase.from('teacher_assignments').select('class_id, teacher_id, subject_id').in('class_id', classIds),
        supabase.from('student_enrollments').select('class_id').in('class_id', classIds).eq('status', 'active'),
      ]);
      if (assignmentResult.error) throw assignmentResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;
      assignments = assignmentResult.data ?? [];
      enrollments = enrollmentResult.data ?? [];
    }

    const teacherIds = [...new Set(assignments.map((assignment) => assignment.teacher_id))];
    let teachers: Array<{ id: string; employee_id: string | null; school_id: string }> = [];
    if (teacherIds.length > 0) {
      let teacherQuery = supabase.from('teachers').select('id, employee_id, school_id').in('id', teacherIds);
      if (role === 'admin' && schoolId) teacherQuery = teacherQuery.eq('school_id', schoolId);
      const { data, error } = await teacherQuery;
      if (error) throw error;
      teachers = data ?? [];
    }

    const validTeacherIds = teachers.map((teacher) => teacher.id);
    let profiles: Array<{ id: string; full_name: string | null }> = [];
    if (validTeacherIds.length > 0) {
      let profileQuery = supabase.from('profiles').select('id, full_name, school_id').in('id', validTeacherIds);
      if (role === 'admin' && schoolId) profileQuery = profileQuery.eq('school_id', schoolId);
      const { data, error } = await profileQuery;
      if (error) throw error;
      profiles = data ?? [];
    }

    const profileNameById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
    const teacherById = new Map(
      teachers.map((teacher) => [
        teacher.id,
        profileNameById.get(teacher.id) ?? teacher.employee_id ?? 'Teacher details unavailable',
      ]),
    );
    const countsByClass = new Map<string, number>();
    for (const enrollment of enrollments) {
      countsByClass.set(enrollment.class_id, (countsByClass.get(enrollment.class_id) ?? 0) + 1);
    }
    const teachersByClass = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      if (!teacherById.has(assignment.teacher_id)) continue;
      const assigned = teachersByClass.get(assignment.class_id) ?? new Set<string>();
      assigned.add(teacherById.get(assignment.teacher_id)!);
      teachersByClass.set(assignment.class_id, assigned);
    }
    const activeClassCount = (classes ?? []).filter((classroom) => classroom.is_active).length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Classes" description="Review classes, active enrollments, and assigned teachers within your authorized scope." />
        <section aria-label="Class summary" className="grid gap-4 sm:grid-cols-2">
          <AdminStatCard label="Loaded classes" value={String(classes?.length ?? 0)} detail="Most recent records (up to 500)" icon={BookOpen} />
          <AdminStatCard label="Active classes" value={String(activeClassCount)} detail="Among loaded records" icon={Users} />
        </section>
        <AdminPanel title="Class directory" description="Student counts include active enrollment records.">
          {!classes?.length ? (
            <AdminEmptyState title="No classes found" description="Classes will appear here when the school has created them." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Code</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Students</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Assigned teachers</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {classes.map((classroom) => (
                    <tr key={classroom.id} className="align-top">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-100">{classroom.name}</p>
                        {classroom.description && <p className="mt-1 max-w-xs text-xs text-gray-500">{classroom.description}</p>}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{classroom.code ?? '—'}</td>
                      <td className="py-3 pr-4 text-gray-300">{countsByClass.get(classroom.id) ?? 0}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {[...(teachersByClass.get(classroom.id) ?? [])].join(', ') || 'No teacher assignment'}
                      </td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-200">{classroom.is_active ? 'Active' : 'Inactive'}</span></td>
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
