import { formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';
import { StudentEmptyState, StudentPageHeader, StudentPanel } from '@/components/dashboard/student-ui';

export default async function StudentExamsPage() {
  const { supabase, studentId } = await requireStudentContext();
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select('class_id')
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (enrollmentError) throw new Error(`Unable to load your class enrollments: ${enrollmentError.message}`);
  const classIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.class_id))];
  const { data: exams, error: examError } =
    classIds.length > 0
      ? await supabase
          .from('exams')
          .select('id, name, subject_id, exam_date, max_marks, is_active')
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('exam_date', { ascending: true })
      : { data: [], error: null };

  if (examError) throw new Error(`Unable to load exams: ${examError.message}`);

  const examIds = (exams ?? []).map((exam) => exam.id);
  const [{ data: subjects, error: subjectError }, { data: results, error: resultError }] =
    examIds.length > 0
      ? await Promise.all([
          supabase
            .from('subjects')
            .select('id, name')
            .in('id', [...new Set((exams ?? []).map((exam) => exam.subject_id))]),
          supabase
            .from('results')
            .select('exam_id, marks_obtained, grade')
            .eq('student_id', studentId)
            .eq('is_published', true)
            .in('exam_id', examIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (subjectError) throw new Error(`Unable to load exam subjects: ${subjectError.message}`);
  if (resultError) throw new Error(`Unable to load your published exam results: ${resultError.message}`);

  const subjectById = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));
  const resultByExam = new Map((results ?? []).map((result) => [result.exam_id, result]));

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Exams" description="Active examinations scheduled for your enrolled classes and results released to you." />
      <StudentPanel title="Class examinations" description="Only active exams and published personal results are shown.">
        {!exams?.length ? (
          <StudentEmptyState
            title={classIds.length ? 'No active exams scheduled' : 'No active class enrollments'}
            description={
              classIds.length
                ? 'Your school has not scheduled an active exam for your classes.'
                : 'Exam schedules will appear after your school enrolls you in a class.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Exam</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Subject</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Maximum</th>
                  <th scope="col" className="pb-3 font-medium">Published result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {exams.map((exam) => {
                  const result = resultByExam.get(exam.id);
                  return (
                    <tr key={exam.id}>
                      <td className="py-3 pr-4 font-medium text-gray-100">{exam.name}</td>
                      <td className="py-3 pr-4 text-gray-300">{subjectById.get(exam.subject_id) ?? 'Not specified'}</td>
                      <td className="py-3 pr-4 text-gray-300">{formatStudentDate(exam.exam_date)}</td>
                      <td className="py-3 pr-4 text-gray-300">{exam.max_marks}</td>
                      <td className="py-3 text-gray-300">
                        {result ? `${result.marks_obtained ?? '—'}${result.grade ? ` (${result.grade})` : ''}` : 'Not released'}
                      </td>
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
