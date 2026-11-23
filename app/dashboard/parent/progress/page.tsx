import { BookCheck, ChartNoAxesCombined, GraduationCap } from 'lucide-react';
import {
  ParentEmptyState,
  ParentErrorState,
  ParentPageHeader,
  ParentPanel,
  ParentStatCard,
  renderParentPageSafely,
} from '@/components/dashboard/parent-ui';
import {
  loadParentChildren,
  requireParentContext,
} from '@/lib/parent-dashboard';

export default async function ParentProgressPage() {
  const context = await requireParentContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <ParentPageHeader title="Academic progress" description="Review available examination results and learning progress for your children." />
        <ParentErrorState />
      </div>
    );
  }

  return renderParentPageSafely('progress', async () => {
    if (!context.schoolId) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Academic progress" description="Review available examination results and learning progress for your children." />
          <ParentEmptyState title="School assignment required" description="Your parent profile is not assigned to a school." />
        </div>
      );
    }

    const children = await loadParentChildren(context);
    if (!children.length) {
      return (
        <div className="space-y-6">
          <ParentPageHeader title="Academic progress" description="Review available examination results and learning progress for your children." />
          <ParentEmptyState title="No linked children found" description="Results and learning progress are available only for children linked to your account." />
        </div>
      );
    }

    const childIds = children.map((child) => child.id);
    const { data: results, error: resultError } = await context.supabase
      .from('results')
      .select('id, student_id, exam_id, marks_obtained, grade, remarks')
      .in('student_id', childIds)
      .limit(500);
    if (resultError) throw resultError;

    const resultRows = results ?? [];
    const examIds = [...new Set(resultRows.map((result) => result.exam_id))];
    let exams: Array<{ id: string; name: string }> = [];
    if (examIds.length) {
      const { data, error } = await context.supabase
        .from('exams')
        .select('id, name')
        .in('id', examIds);
      if (error) throw error;
      exams = data ?? [];
    }

    const { data: learningProgress, error: learningError } = await context.supabase
      .from('lms_progress')
      .select('id, student_id, completed')
      .in('student_id', childIds)
      .limit(1000);
    if (learningError) {
      console.error('Unable to load parent LMS progress:', learningError);
    }

    const childById = new Map(children.map((child) => [child.id, child]));
    const examById = new Map(exams.map((exam) => [exam.id, exam.name]));
    const scoredResults = resultRows.filter((result) => result.marks_obtained !== null);
    const average = scoredResults.length
      ? Math.round(scoredResults.reduce((sum, result) => sum + (result.marks_obtained ?? 0), 0) / scoredResults.length)
      : null;
    const completedLessons = (learningProgress ?? []).filter((item) => item.completed).length;

    return (
      <div className="space-y-6">
        <ParentPageHeader title="Academic progress" description="Examination results and available learning progress for children linked to your parent account." />
        <section aria-label="Academic progress summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ParentStatCard label="Recorded results" value={String(resultRows.length)} detail="For linked children only" icon={GraduationCap} />
          <ParentStatCard label="Average marks" value={average === null ? '—' : String(average)} detail="Raw marks among results with marks recorded" icon={ChartNoAxesCombined} />
          <ParentStatCard label="Completed lessons" value={learningError ? '—' : String(completedLessons)} detail="Across linked children" icon={BookCheck} />
        </section>
        <ParentPanel title="Examination results" description="Results are grouped by child and use the existing result and exam records.">
          {!resultRows.length ? (
            <ParentEmptyState title="No examination results" description="No recorded examination results are available for your linked children." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="pb-3 pr-4 font-medium">Child</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Examination</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Marks</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Grade</th>
                    <th scope="col" className="pb-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {resultRows.map((result) => (
                    <tr key={result.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{childById.get(result.student_id)?.full_name ?? 'Child unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{examById.get(result.exam_id) ?? 'Examination unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">{result.marks_obtained ?? '—'}</td>
                      <td className="py-3 pr-4 text-gray-300">{result.grade ?? '—'}</td>
                      <td className="py-3 text-gray-400">{result.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ParentPanel>
        <ParentPanel title="Learning management progress" description="Learning progress is queried only for the verified linked children.">
          {learningError ? (
            <ParentErrorState title="LMS progress is unavailable" error={learningError} />
          ) : !learningProgress?.length ? (
            <ParentEmptyState title="No LMS progress available" description="No LMS progress records are available for your linked children." />
          ) : (
            <ul className="divide-y divide-gray-800">
              {children.map((child) => {
                const childProgress = learningProgress.filter((item) => item.student_id === child.id);
                if (!childProgress.length) return null;
                const complete = childProgress.filter((item) => item.completed).length;
                return (
                  <li key={child.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span className="font-medium text-gray-200">{child.full_name}</span>
                    <span className="text-gray-400">{complete} of {childProgress.length} lessons complete</span>
                  </li>
                );
              })}
            </ul>
          )}
        </ParentPanel>
      </div>
    );
  });
}
