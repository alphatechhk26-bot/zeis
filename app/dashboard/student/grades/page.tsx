import { ChartNoAxesCombined } from 'lucide-react';
import { formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';
import {
  StudentEmptyState,
  StudentPageHeader,
  StudentPanel,
  StudentStatCard,
} from '@/components/dashboard/student-ui';

export default async function StudentGradesPage() {
  const { supabase, studentId } = await requireStudentContext();
  const { data: results, error: resultError } = await supabase
    .from('results')
    .select('id, exam_id, marks_obtained, grade, created_at')
    .eq('student_id', studentId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (resultError) throw new Error(`Unable to load your published grades: ${resultError.message}`);

  const examIds = [...new Set((results ?? []).map((result) => result.exam_id))];
  const { data: exams, error: examError } =
    examIds.length > 0
      ? await supabase
          .from('exams')
          .select('id, name, subject_id, exam_date, max_marks')
          .in('id', examIds)
      : { data: [], error: null };

  if (examError) throw new Error(`Unable to load exam details: ${examError.message}`);

  const subjectIds = [...new Set((exams ?? []).map((exam) => exam.subject_id))];
  const { data: subjects, error: subjectError } =
    subjectIds.length > 0
      ? await supabase.from('subjects').select('id, name').in('id', subjectIds)
      : { data: [], error: null };

  if (subjectError) throw new Error(`Unable to load subject details: ${subjectError.message}`);

  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));
  const subjectById = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));
  const normalizedScores = (results ?? [])
    .map((result) => {
      const exam = examById.get(result.exam_id);
      if (result.marks_obtained === null || !exam?.max_marks) return null;
      return (result.marks_obtained / exam.max_marks) * 100;
    })
    .filter((score): score is number => score !== null);
  const average = normalizedScores.length
    ? normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length
    : null;

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Grades" description="View examination marks and grades released by your school." />
      <StudentStatCard
        label="Published results"
        value={String(results?.length ?? 0)}
        detail={average === null ? 'No scored results available' : `Average: ${average.toFixed(1)}% of maximum marks`}
        icon={ChartNoAxesCombined}
      />
      <StudentPanel title="Published results" description="Only results published to your student account are displayed.">
        {!results?.length ? (
          <StudentEmptyState
            title="No grades published yet"
            description="Your examination results will appear here after they have been released by your school."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Exam</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Subject</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Marks</th>
                  <th scope="col" className="pb-3 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {results.map((result) => {
                  const exam = examById.get(result.exam_id);
                  return (
                    <tr key={result.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{exam?.name ?? 'Exam details unavailable'}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {exam ? subjectById.get(exam.subject_id) ?? 'Not specified' : 'Not specified'}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{formatStudentDate(exam?.exam_date ?? null)}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {result.marks_obtained ?? '—'}{exam ? ` / ${exam.max_marks}` : ''}
                      </td>
                      <td className="py-3 text-gray-300">{result.grade ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </StudentPanel>
    </div>
  );
}
