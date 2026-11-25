import { BookOpen, Users } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { ClassesManager } from '@/components/dashboard/classes-manager';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminClassesPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Classes" description="Manage classes and teacher assignments for your school." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, schoolId } = context;

  return renderAdminPageSafely('classes', async () => {
    if (!schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Classes" description="Manage classes and teacher assignments for your school." />
          <AdminEmptyState title="School assignment required" description="Your administrator profile must be assigned to a school before managing classes." />
        </div>
      );
    }

    const [classResult, teacherResult, subjectResult, yearResult] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, code, description, school_id, is_active, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('name')
        .limit(500),
      supabase
        .from('teachers')
        .select('id, employee_id, school_id')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false }),
      supabase.from('subjects').select('id, name, school_id').eq('school_id', schoolId).order('name'),
      supabase
        .from('academic_years')
        .select('id, name, school_id')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false }),
    ]);
    if (classResult.error) throw classResult.error;
    if (teacherResult.error) throw teacherResult.error;
    if (subjectResult.error) throw subjectResult.error;
    if (yearResult.error) throw yearResult.error;

    const classes = classResult.data ?? [];
    const teacherIds = (teacherResult.data ?? []).map((teacher) => teacher.id);
    const { data: teacherProfiles, error: profileError } = teacherIds.length
      ? await supabase
          .from('profiles')
          .select('id, full_name, school_id')
          .in('id', teacherIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (profileError) throw profileError;

    const classIds = classes.map((row) => row.id);
    const [assignmentResult, enrollmentResult] = classIds.length
      ? await Promise.all([
          supabase
            .from('teacher_assignments')
            .select('id, class_id, teacher_id, subject_id, academic_year_id')
            .in('class_id', classIds),
          supabase
            .from('student_enrollments')
            .select('class_id, student_id')
            .in('class_id', classIds)
            .eq('status', 'active'),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (assignmentResult.error) throw assignmentResult.error;
    if (enrollmentResult.error) throw enrollmentResult.error;

    const enrolledStudentIds = [...new Set((enrollmentResult.data ?? []).map((row) => row.student_id))];
    const { data: validStudents, error: studentError } = enrolledStudentIds.length
      ? await supabase
          .from('students')
          .select('id')
          .in('id', enrolledStudentIds)
          .eq('school_id', schoolId)
      : { data: [], error: null };
    if (studentError) throw studentError;
    const validStudentIds = new Set((validStudents ?? []).map((row) => row.id));

    const assignmentRows = assignmentResult.data ?? [];
    const assignedTeacherIds = [...new Set(assignmentRows.map((row) => row.teacher_id))];
    const assignedSubjectIds = [...new Set(assignmentRows.map((row) => row.subject_id))];
    const assignedYearIds = [...new Set(assignmentRows.map((row) => row.academic_year_id))];
    const [assignedTeachersResult, assignedSubjectsResult, assignedYearsResult] = await Promise.all([
      assignedTeacherIds.length
        ? supabase.from('teachers').select('id, employee_id, school_id').in('id', assignedTeacherIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
      assignedSubjectIds.length
        ? supabase.from('subjects').select('id, name, school_id').in('id', assignedSubjectIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
      assignedYearIds.length
        ? supabase.from('academic_years').select('id, name, school_id').in('id', assignedYearIds).eq('school_id', schoolId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (assignedTeachersResult.error) throw assignedTeachersResult.error;
    if (assignedSubjectsResult.error) throw assignedSubjectsResult.error;
    if (assignedYearsResult.error) throw assignedYearsResult.error;

    const profileNameById = new Map((teacherProfiles ?? []).map((profile) => [profile.id, profile.full_name]));
    const teacherById = new Map(
      [...(assignedTeachersResult.data ?? [])].map((teacher) => [
        teacher.id,
        profileNameById.get(teacher.id) ?? teacher.employee_id ?? 'Teacher',
      ])
    );
    const subjectById = new Map((assignedSubjectsResult.data ?? []).map((subject) => [subject.id, subject.name]));
    const yearById = new Map((assignedYearsResult.data ?? []).map((year) => [year.id, year.name]));
    const classNameById = new Map(classes.map((row) => [row.id, row.name]));
    const assignments = assignmentRows
      .filter((row) =>
        classNameById.has(row.class_id) &&
        teacherById.has(row.teacher_id) &&
        subjectById.has(row.subject_id) &&
        yearById.has(row.academic_year_id)
      )
      .map((row) => ({
        ...row,
        teacher_name: teacherById.get(row.teacher_id)!,
        subject_name: subjectById.get(row.subject_id)!,
        academic_year_name: yearById.get(row.academic_year_id)!,
      }));

    const classesWithCounts = classes.map((row) => ({
      ...row,
      activeEnrollmentCount: (enrollmentResult.data ?? []).filter(
        (enrollment) => enrollment.class_id === row.id && validStudentIds.has(enrollment.student_id)
      ).length,
    }));

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Classes" description="Manage classes and teacher assignments within your authenticated school." />
        <section aria-label="Class summary" className="grid gap-4 sm:grid-cols-2">
          <AdminStatCard label="Loaded classes" value={String(classes.length)} detail="Most recent records (up to 500)" icon={BookOpen} />
          <AdminStatCard label="Active classes" value={String(classes.filter((row) => row.is_active).length)} detail="Among loaded records" icon={Users} />
        </section>
        <AdminPanel title="Class directory" description="Teacher assignments and enrollment counts are restricted to this school.">
          <ClassesManager
            initialClasses={classesWithCounts}
            initialAssignments={assignments}
            teachers={(teacherResult.data ?? []).map((teacher) => ({
              id: teacher.id,
              label: profileNameById.get(teacher.id) ?? teacher.employee_id ?? 'Teacher',
            }))}
            subjects={(subjectResult.data ?? []).map((subject) => ({ id: subject.id, label: subject.name }))}
            academicYears={(yearResult.data ?? []).map((year) => ({ id: year.id, label: year.name }))}
          />
        </AdminPanel>
      </div>
    );
  });
}
