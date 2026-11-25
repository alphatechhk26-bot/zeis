import { ClipboardCheck, Users } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { ExamsManager } from '@/components/dashboard/exams-manager';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminExamsPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Exams" description="Schedule exams and review submitted results for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderAdminPageSafely('exams', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Exams" description="Schedule exams and review submitted results for your school." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing exams." />
        </div>
      );
    }

    const [examsResult, classesResult, subjectsResult, yearsResult] = await Promise.all([
      supabase
        .from('exams')
        .select('id, school_id, name, academic_year_id, term_id, class_id, subject_id, exam_date, max_marks, exam_type, is_active')
        .eq('school_id', schoolId)
        .order('exam_date', { ascending: true })
        .limit(500),
      supabase
        .from('classes')
        .select('id, name, school_id')
        .eq('school_id', schoolId)
        .order('name'),
      supabase
        .from('subjects')
        .select('id, name, school_id')
        .eq('school_id', schoolId)
        .order('name'),
      supabase
        .from('academic_years')
        .select('id, name, school_id, start_date, end_date')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
    ]);
    if (examsResult.error) throw examsResult.error;
    if (classesResult.error) throw classesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (yearsResult.error) throw yearsResult.error;

    const years = yearsResult.data ?? [];
    const yearIds = years.map((year) => year.id);
    const { data: terms, error: termError } = yearIds.length
      ? await supabase
          .from('terms')
          .select('id, academic_year_id, name, start_date, end_date')
          .in('academic_year_id', yearIds)
          .order('term_number')
      : { data: [], error: null };
    if (termError) throw termError;

    const exams = examsResult.data ?? [];
    const examIds = exams.map((exam) => exam.id);
    const { data: rawResults, error: resultError } = examIds.length
      ? await supabase
          .from('results')
          .select('id, school_id, exam_id, student_id, marks_obtained, grade, remarks, is_published')
          .in('exam_id', examIds)
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (resultError) throw resultError;

    const studentIds = [...new Set((rawResults ?? []).map((result) => result.student_id))];
    const { data: students, error: studentError } = studentIds.length
      ? await supabase
          .from('students')
          .select('id, admission_number, school_id')
          .in('id', studentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (studentError) throw studentError;
    const { data: profiles, error: profileError } = studentIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', studentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const studentById = new Map((students ?? []).map((student) => [student.id, student]));
    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const resultsByExam = new Map<string, Array<{
      id: string;
      student_id: string;
      student_name: string;
      admission_number: string;
      marks_obtained: number | null;
      grade: string | null;
      remarks: string | null;
      is_published: boolean | null;
    }>>();
    for (const result of rawResults ?? []) {
      const student = studentById.get(result.student_id);
      if (!student) continue;
      const rows = resultsByExam.get(result.exam_id) ?? [];
      rows.push({
        id: result.id,
        student_id: result.student_id,
        student_name: nameById.get(result.student_id) ?? 'Student',
        admission_number: student.admission_number ?? '—',
        marks_obtained: result.marks_obtained,
        grade: result.grade,
        remarks: result.remarks,
        is_published: result.is_published,
      });
      resultsByExam.set(result.exam_id, rows);
    }

    const classes = classesResult.data ?? [];
    const subjects = subjectsResult.data ?? [];
    const resultCount = rawResults?.length ?? 0;
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Exams" description="Manage scheduled exams and view submitted results within your authenticated school." />
        <section aria-label="Exam summary" className="grid gap-4 sm:grid-cols-2">
          <AdminStatCard label="Scheduled exams" value={String(exams.length)} detail="Most recent schedules (up to 500)" icon={ClipboardCheck} />
          <AdminStatCard label="Submitted results" value={String(resultCount)} detail="For exams in this school" icon={Users} />
        </section>
        <AdminPanel title="Examination schedule" description="Exam links are validated against this school's active class-subject assignments.">
          <ExamsManager
            initialExams={exams.map((exam) => ({
              ...exam,
              name: exam.name,
              results: resultsByExam.get(exam.id) ?? [],
            }))}
            classes={classes.map(({ id, name }) => ({ id, label: name }))}
            subjects={subjects.map(({ id, name }) => ({ id, label: name }))}
            academicYears={years.map((year) => ({
              id: year.id,
              label: year.name,
              start_date: year.start_date,
              end_date: year.end_date,
            }))}
            terms={(terms ?? []).map((term) => ({
              id: term.id,
              label: term.name,
              academic_year_id: term.academic_year_id,
              start_date: term.start_date,
              end_date: term.end_date,
            }))}
          />
        </AdminPanel>
      </div>
    );
  });
}
