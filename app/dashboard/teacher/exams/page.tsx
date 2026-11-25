import { TeacherExamsManager } from '@/components/dashboard/teacher-exams-manager';
import {
  renderTeacherPageSafely,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherExamsPage() {
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Exams" description="Review scheduled exams and enter marks for your assigned classes." />
        <TeacherErrorState />
      </div>
    );
  }

  return renderTeacherPageSafely('exams', async () => {
    const assignments = await getTeacherAssignmentOptions(context);
    const classIds = [...new Set(assignments.map((item) => item.classId))];
    const subjectIds = [...new Set(assignments.map((item) => item.subjectId))];
    const yearIds = [...new Set(assignments.map((item) => item.academicYearId))];
    const { data: records, error } = classIds.length
      ? await context.supabase.from('exams')
          .select('id, name, class_id, subject_id, academic_year_id, exam_date, max_marks, is_active')
          .eq('school_id', context.schoolId)
          .in('class_id', classIds)
          .in('subject_id', subjectIds)
          .in('academic_year_id', yearIds)
          .order('exam_date', { ascending: true })
      : { data: [], error: null };
    if (error) throw new Error(`Unable to load examinations for your assignments: ${error.message}`);

    const allowed = new Set(assignments.map((item) => `${item.classId}:${item.subjectId}:${item.academicYearId}`));
    const classNames = new Map(assignments.map((item) => [item.classId, item.className]));
    const subjectNames = new Map(assignments.map((item) => [item.subjectId, item.subjectName]));
    const exams = (records ?? [])
      .filter((exam) => allowed.has(`${exam.class_id}:${exam.subject_id}:${exam.academic_year_id}`))
      .map((exam) => ({
        id: exam.id,
        name: exam.name,
        className: classNames.get(exam.class_id) ?? 'Class',
        subjectName: subjectNames.get(exam.subject_id) ?? 'Subject',
        examDate: exam.exam_date,
        maxMarks: exam.max_marks,
      }));

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Exams" description="Review scheduled exams and enter marks for your assigned classes." />
        <TeacherPanel title="Scheduled exams and marks" description="Only exams matching your verified class, subject, and academic-year assignments are available.">
          <TeacherExamsManager exams={exams} />
        </TeacherPanel>
      </div>
    );
  });
}
