import { TeacherEmptyState, TeacherPageHeader, TeacherPanel } from '@/components/dashboard/teacher-ui';
import { formatTeacherDate, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherExamsPage() {
  const { supabase, teacherId, schoolId } = await requireTeacherContext();

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Exams" description="Examinations scheduled for your assigned classes." />
        <TeacherEmptyState title="School assignment pending" description="Exam schedules will appear after a school is assigned to your account." />
      </div>
    );
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('teacher_assignments')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (assignmentError) throw new Error(`Unable to load your assigned classes: ${assignmentError.message}`);

  const classIds = [...new Set((assignments ?? []).map((assignment) => assignment.class_id))];
  const { data: exams, error: examError } =
    classIds.length > 0
      ? await supabase
          .from('exams')
          .select('id, name, class_id, subject_id, exam_date, max_marks, is_active')
          .eq('school_id', schoolId)
          .in('class_id', classIds)
          .order('exam_date', { ascending: true })
      : { data: [], error: null };
  if (examError) throw new Error(`Unable to load examinations for your classes: ${examError.message}`);

  const [classResult, subjectResult] =
    exams?.length
      ? await Promise.all([
          supabase.from('classes').select('id, name').eq('school_id', schoolId).in('id', classIds),
          supabase.from('subjects').select('id, name').eq('school_id', schoolId).in('id', [...new Set(exams.map((exam) => exam.subject_id))]),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (classResult.error) throw new Error(`Unable to load exam class details: ${classResult.error.message}`);
  if (subjectResult.error) throw new Error(`Unable to load exam subject details: ${subjectResult.error.message}`);

  const classById = new Map((classResult.data ?? []).map((classroom) => [classroom.id, classroom.name]));
  const subjectById = new Map((subjectResult.data ?? []).map((subject) => [subject.id, subject.name]));

  return (
    <div className="space-y-6">
      <TeacherPageHeader title="Exams" description="Examinations scheduled for classes assigned to you." />
      <TeacherPanel title="Class examinations" description="Exam and subject information is read from your school's schedule.">
        {!exams?.length ? (
          <TeacherEmptyState title={classIds.length ? 'No examinations scheduled' : 'No classes assigned'} description={classIds.length ? 'There are no examinations scheduled for your assigned classes.' : 'Exam schedules will appear after classes are assigned to you.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="pb-3 pr-4 font-medium">Exam</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Class</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Subject</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Date</th>
                  <th scope="col" className="pb-3 pr-4 font-medium">Maximum</th>
                  <th scope="col" className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td className="py-3 pr-4 font-medium text-gray-100">{exam.name}</td>
                    <td className="py-3 pr-4 text-gray-300">{classById.get(exam.class_id) ?? 'Class unavailable'}</td>
                    <td className="py-3 pr-4 text-gray-300">{subjectById.get(exam.subject_id) ?? 'Not specified'}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatTeacherDate(exam.exam_date)}</td>
                    <td className="py-3 pr-4 text-gray-300">{exam.max_marks}</td>
                    <td className="py-3 text-gray-300">{exam.is_active ? 'Active' : 'Inactive'}</td>
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
