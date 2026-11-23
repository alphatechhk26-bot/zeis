import { BookOpen } from 'lucide-react';
import {
  renderTeacherPageSafely,
  TeacherEmptyState,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherClassesPage() {
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="My Classes" description="Classes and subjects assigned to you." />
        <TeacherErrorState />
      </div>
    );
  }
  const { supabase, teacherId, schoolId } = context;

  return renderTeacherPageSafely('classes', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <TeacherPageHeader title="My Classes" description="Classes and subjects assigned to you." />
          <TeacherEmptyState title="School assignment pending" description="Your classes will appear after a school is assigned to your account." />
        </div>
      );
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from('teacher_assignments')
      .select('class_id, subject_id, academic_year_id')
      .eq('teacher_id', teacherId);

    if (assignmentError) throw new Error(`Unable to load your teaching assignments: ${assignmentError.message}`);

    const classIds = [...new Set((assignments ?? []).map((assignment) => assignment.class_id))];
    const subjectIds = [...new Set((assignments ?? []).map((assignment) => assignment.subject_id))];
    const academicYearIds = [...new Set((assignments ?? []).map((assignment) => assignment.academic_year_id))];

    const [classResult, subjectResult, yearResult, enrollmentResult] =
      classIds.length > 0
        ? await Promise.all([
            supabase.from('classes').select('id, name, code, description').eq('school_id', schoolId).in('id', classIds),
            subjectIds.length > 0
              ? supabase.from('subjects').select('id, name, code').eq('school_id', schoolId).in('id', subjectIds)
              : Promise.resolve({ data: [], error: null }),
            academicYearIds.length > 0
              ? supabase.from('academic_years').select('id, name').eq('school_id', schoolId).in('id', academicYearIds)
              : Promise.resolve({ data: [], error: null }),
            supabase.from('student_enrollments').select('class_id').in('class_id', classIds).eq('status', 'active'),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (classResult.error) throw new Error(`Unable to load class details: ${classResult.error.message}`);
    if (subjectResult.error) throw new Error(`Unable to load assigned subjects: ${subjectResult.error.message}`);
    if (yearResult.error) throw new Error(`Unable to load academic years: ${yearResult.error.message}`);
    if (enrollmentResult.error) throw new Error(`Unable to count active class enrollments: ${enrollmentResult.error.message}`);

    const subjectsById = new Map((subjectResult.data ?? []).map((subject) => [subject.id, subject]));
    const yearsById = new Map((yearResult.data ?? []).map((year) => [year.id, year.name]));
    const countsByClass = new Map<string, number>();
    for (const enrollment of enrollmentResult.data ?? []) {
      countsByClass.set(enrollment.class_id, (countsByClass.get(enrollment.class_id) ?? 0) + 1);
    }
    const assignmentsByClass = new Map<string, typeof assignments>();
    for (const assignment of assignments ?? []) {
      const classAssignments = assignmentsByClass.get(assignment.class_id) ?? [];
      classAssignments.push(assignment);
      assignmentsByClass.set(assignment.class_id, classAssignments);
    }

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="My Classes" description="Classes, subjects, and academic years assigned to you." />
        <TeacherPanel title="Assigned classes" description="Student totals reflect active enrollments in each assigned class.">
          {!classResult.data?.length ? (
            <TeacherEmptyState title="No classes assigned" description="Your school has not assigned any classes or subjects to you yet." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {classResult.data.map((classroom) => (
                <li key={classroom.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{classroom.name}</h3>
                      {classroom.code && <p className="mt-1 text-xs text-gray-500">{classroom.code}</p>}
                    </div>
                  </div>
                  {classroom.description && <p className="mt-3 text-sm leading-6 text-gray-400">{classroom.description}</p>}
                  <p className="mt-4 text-sm text-gray-300">
                    {countsByClass.get(classroom.id) ?? 0} active students
                  </p>
                  <div className="mt-4 border-t border-gray-800 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Teaching assignments</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {(assignmentsByClass.get(classroom.id) ?? []).map((assignment) => {
                        const subject = subjectsById.get(assignment.subject_id);
                        return (
                          <li key={`${assignment.subject_id}:${assignment.academic_year_id}`} className="rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-300">
                            {subject?.name ?? 'Subject'}{yearsById.get(assignment.academic_year_id) ? ` · ${yearsById.get(assignment.academic_year_id)}` : ''}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TeacherPanel>
      </div>
    );
  });
}
