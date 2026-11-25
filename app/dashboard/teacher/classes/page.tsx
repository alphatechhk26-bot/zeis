import { BookOpen } from 'lucide-react';
import {
  renderTeacherPageSafely,
  TeacherEmptyState,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

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
  const { supabase, schoolId } = context;

  return renderTeacherPageSafely('classes', async () => {
    const assignments = await getTeacherAssignmentOptions(context);
    const classIds = [...new Set(assignments.map((assignment) => assignment.classId))];
    const yearIds = [...new Set(assignments.map((assignment) => assignment.academicYearId))];
    const allowedClassYears = new Set(assignments.map((assignment) => `${assignment.classId}:${assignment.academicYearId}`));
    const { data: classes, error: classError } = classIds.length
      ? await supabase.from('classes').select('id, name, code, description').eq('school_id', schoolId).in('id', classIds)
      : { data: [], error: null };
    if (classError) throw new Error(`Unable to load class details: ${classError.message}`);

    const { data: enrollments, error: enrollmentError } = classIds.length
      ? await supabase.from('student_enrollments').select('class_id, student_id, academic_year_id').in('class_id', classIds).in('academic_year_id', yearIds).eq('status', 'active')
      : { data: [], error: null };
    if (enrollmentError) throw new Error(`Unable to count active class enrollments: ${enrollmentError.message}`);
    const studentIds = [...new Set((enrollments ?? []).map((row) => row.student_id))];
    const { data: students, error: studentsError } = studentIds.length
      ? await supabase.from('students').select('id').eq('school_id', schoolId).in('id', studentIds)
      : { data: [], error: null };
    if (studentsError) throw new Error(`Unable to verify class student totals: ${studentsError.message}`);

    const validStudentIds = new Set((students ?? []).map((student) => student.id));
    const countsByClass = new Map<string, number>();
    const countedStudents = new Set<string>();
    for (const enrollment of enrollments ?? []) {
      const key = `${enrollment.class_id}:${enrollment.student_id}`;
      if (
        validStudentIds.has(enrollment.student_id) &&
        allowedClassYears.has(`${enrollment.class_id}:${enrollment.academic_year_id}`) &&
        !countedStudents.has(key)
      ) {
        countsByClass.set(enrollment.class_id, (countsByClass.get(enrollment.class_id) ?? 0) + 1);
        countedStudents.add(key);
      }
    }
    const assignmentsByClass = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const current = assignmentsByClass.get(assignment.classId) ?? [];
      current.push(assignment);
      assignmentsByClass.set(assignment.classId, current);
    }

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="My Classes" description="Classes, subjects, and academic years assigned to you." />
        <TeacherPanel title="Assigned classes" description="Student totals reflect active enrollments in each assigned class.">
          {!classes?.length ? (
            <TeacherEmptyState title="No classes assigned" description="Your school has not assigned any valid class and subject combinations to you yet." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {classes.map((classroom) => (
                <li key={classroom.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{classroom.name}</h3>
                      {classroom.code && <p className="mt-1 text-xs text-gray-500">{classroom.code}</p>}
                    </div>
                  </div>
                  {classroom.description && <p className="mt-3 text-sm leading-6 text-gray-400">{classroom.description}</p>}
                  <p className="mt-4 text-sm text-gray-300">{countsByClass.get(classroom.id) ?? 0} active students</p>
                  <div className="mt-4 border-t border-gray-800 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Teaching assignments</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {(assignmentsByClass.get(classroom.id) ?? []).map((assignment) => (
                        <li key={`${assignment.subjectId}:${assignment.academicYearId}`} className="rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-300">
                          {assignment.subjectName} · {assignment.academicYearName}
                        </li>
                      ))}
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
