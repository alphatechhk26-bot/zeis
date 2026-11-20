import { BookOpen } from 'lucide-react';
import { StudentEmptyState, StudentPageHeader, StudentPanel } from '@/components/dashboard/student-ui';
import { formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';

export default async function StudentClassesPage() {
  const { supabase, studentId } = await requireStudentContext();
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select('id, class_id, academic_year_id, enrollment_date, status')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('enrollment_date', { ascending: false });

  if (enrollmentError) throw new Error(`Unable to load your classes: ${enrollmentError.message}`);
  const classIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.class_id))];
  const academicYearIds = [...new Set((enrollments ?? []).map((enrollment) => enrollment.academic_year_id))];

  const [{ data: classes, error: classError }, { data: academicYears, error: yearError }] =
    classIds.length > 0
      ? await Promise.all([
          supabase.from('classes').select('id, name, code, description').in('id', classIds),
          supabase
            .from('academic_years')
            .select('id, name')
            .in('id', academicYearIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  if (classError) throw new Error(`Unable to load class details: ${classError.message}`);
  if (yearError) throw new Error(`Unable to load academic years: ${yearError.message}`);

  const [{ data: classSubjects, error: classSubjectError }] =
    classIds.length > 0 && academicYearIds.length > 0
      ? await Promise.all([
          supabase
            .from('class_subjects')
            .select('class_id, academic_year_id, subject_id')
            .in('class_id', classIds)
            .in('academic_year_id', academicYearIds)
            .eq('is_active', true),
        ])
      : [{ data: [], error: null }];

  if (classSubjectError) throw new Error(`Unable to load your subjects: ${classSubjectError.message}`);

  const subjectIds = [...new Set((classSubjects ?? []).map((item) => item.subject_id))];
  const { data: subjects, error: subjectError } =
    subjectIds.length > 0
      ? await supabase.from('subjects').select('id, name, code').in('id', subjectIds)
      : { data: [], error: null };

  if (subjectError) throw new Error(`Unable to load subject details: ${subjectError.message}`);

  const classById = new Map((classes ?? []).map((item) => [item.id, item]));
  const yearById = new Map((academicYears ?? []).map((item) => [item.id, item.name]));
  const subjectById = new Map((subjects ?? []).map((item) => [item.id, item]));
  const subjectsByClassAndYear = new Map<string, string[]>();
  for (const item of classSubjects ?? []) {
    const key = `${item.class_id}:${item.academic_year_id}`;
    const assigned = subjectsByClassAndYear.get(key) ?? [];
    const subjectName = subjectById.get(item.subject_id)?.name;
    if (subjectName) assigned.push(subjectName);
    subjectsByClassAndYear.set(key, assigned);
  }

  return (
    <div className="space-y-6">
      <StudentPageHeader title="My Classes" description="Your active class enrollments, subjects, and academic years." />
      <StudentPanel title="Enrolled classes" description="Class and subject details from your current enrollments.">
        {!enrollments?.length ? (
          <StudentEmptyState
            title="No active class enrollments"
            description="Your classes will appear here after your school completes your enrollment."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {enrollments.map((enrollment) => {
              const classroom = classById.get(enrollment.class_id);
              const subjects = subjectsByClassAndYear.get(
                `${enrollment.class_id}:${enrollment.academic_year_id}`,
              ) ?? [];
              return (
                <li key={enrollment.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{classroom?.name ?? 'Class details unavailable'}</h3>
                      {classroom?.code && <p className="mt-1 text-xs text-gray-500">{classroom.code}</p>}
                    </div>
                  </div>
                  {classroom?.description && <p className="mt-3 text-sm leading-6 text-gray-400">{classroom.description}</p>}
                  <dl className="mt-4 grid gap-2 border-t border-gray-800 pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Academic year</dt>
                      <dd className="text-right text-gray-300">{yearById.get(enrollment.academic_year_id) ?? 'Not specified'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Enrolled</dt>
                      <dd className="text-right text-gray-300">{formatStudentDate(enrollment.enrollment_date)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Subjects</p>
                    {subjects.length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {subjects.map((subject, index) => (
                          <li key={`${subject}-${index}`} className="rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-300">
                            {subject}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">No subjects have been assigned yet.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </StudentPanel>
    </div>
  );
}
