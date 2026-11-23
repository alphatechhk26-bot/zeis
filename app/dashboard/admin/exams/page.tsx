import { ClipboardCheck } from 'lucide-react';
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

export default async function AdminExamsPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Exams" description="Review examinations scheduled across your authorized school scope." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('exams', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Exams" description="Review examinations scheduled across your authorized school scope." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so exam records cannot be loaded." />
        </div>
      );
    }

    let examsQuery = supabase
      .from('exams')
      .select('id, name, class_id, subject_id, exam_date, max_marks, is_active, school_id')
      .order('exam_date', { ascending: true })
      .limit(500);
    if (role === 'admin' && schoolId) examsQuery = examsQuery.eq('school_id', schoolId);

    const { data: exams, error: examError } = await examsQuery;
    if (examError) throw examError;

    const classIds = [...new Set((exams ?? []).map((exam) => exam.class_id))];
    const subjectIds = [...new Set((exams ?? []).map((exam) => exam.subject_id))];
    let classRows: Array<{ id: string; name: string }> = [];
    let subjectRows: Array<{ id: string; name: string }> = [];
    if (classIds.length > 0) {
      let classQuery = supabase.from('classes').select('id, name').in('id', classIds);
      if (role === 'admin' && schoolId) classQuery = classQuery.eq('school_id', schoolId);
      const { data, error } = await classQuery;
      if (error) throw error;
      classRows = data ?? [];
    }
    if (subjectIds.length > 0) {
      let subjectQuery = supabase.from('subjects').select('id, name').in('id', subjectIds);
      if (role === 'admin' && schoolId) subjectQuery = subjectQuery.eq('school_id', schoolId);
      const { data, error } = await subjectQuery;
      if (error) throw error;
      subjectRows = data ?? [];
    }

    const classById = new Map(classRows.map((classroom) => [classroom.id, classroom.name]));
    const subjectById = new Map(subjectRows.map((subject) => [subject.id, subject.name]));

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Exams" description="Review scheduled examinations for your school or platform scope." />
        <AdminStatCard label="Loaded exams" value={String(exams?.length ?? 0)} detail="Most recent schedules (up to 500)" icon={ClipboardCheck} />
        <AdminPanel title="Examination schedule" description="Exam dates and subjects come from the exam records in Supabase.">
          {!exams?.length ? (
            <AdminEmptyState title="No examinations found" description="Examinations will appear here when they are scheduled." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Exam</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Subject</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Maximum marks</th>
                    <th scope="col" className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {exams.map((exam) => (
                    <tr key={exam.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{exam.name}</td>
                      <td className="py-3 pr-4 text-gray-300">{classById.get(exam.class_id) ?? 'Class unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{subjectById.get(exam.subject_id) ?? 'Not specified'}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatAdminDate(exam.exam_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{exam.max_marks}</td>
                      <td className="py-3"><span className="rounded-full border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-xs text-gray-200">{exam.is_active ? 'Active' : 'Inactive'}</span></td>
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
