import { TeacherEmptyState, TeacherPageHeader, TeacherPanel } from '@/components/dashboard/teacher-ui';
import { formatTeacherDate, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherAssignmentsPage() {
  const { supabase, teacherId, schoolId } = await requireTeacherContext();

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Assignments" description="Assignments in your own courses." />
        <TeacherEmptyState title="School assignment pending" description="Assignments will appear after a school is assigned to your account." />
      </div>
    );
  }

  const { data: courses, error: courseError } = await supabase
    .from('lms_courses')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('created_by', teacherId);
  if (courseError) throw new Error(`Unable to load your courses: ${courseError.message}`);

  const courseIds = (courses ?? []).map((course) => course.id);
  const { data: assignments, error: assignmentError } =
    courseIds.length > 0
      ? await supabase
          .from('assignments')
          .select('id, title, description, due_date, max_score, is_published, course_id')
          .in('course_id', courseIds)
          .order('due_date', { ascending: true })
      : { data: [], error: null };
  if (assignmentError) throw new Error(`Unable to load your course assignments: ${assignmentError.message}`);

  const courseById = new Map((courses ?? []).map((course) => [course.id, course.name]));

  return (
    <div className="space-y-6">
      <TeacherPageHeader title="Assignments" description="Review assignments associated with courses you created." />
      <TeacherPanel title="Your course assignments" description="Assignment editing is not enabled here because the existing schema has no verified teacher-owned assignment workflow.">
        {!assignments?.length ? (
          <TeacherEmptyState title="No course assignments" description="Assignments in courses created by you will appear here." />
        ) : (
          <ul className="space-y-3">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{assignment.title}</h3>
                    <p className="mt-1 text-sm text-gray-400">{assignment.course_id ? courseById.get(assignment.course_id) ?? 'Course unavailable' : 'Course not specified'}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${assignment.is_published ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-gray-700 bg-gray-800/60 text-gray-300'}`}>
                    {assignment.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {assignment.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{assignment.description}</p>}
                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-800 pt-3 text-xs">
                  <div className="flex gap-2"><dt className="text-gray-500">Due</dt><dd className="text-gray-300">{formatTeacherDate(assignment.due_date)}</dd></div>
                  <div className="flex gap-2"><dt className="text-gray-500">Maximum score</dt><dd className="text-gray-300">{assignment.max_score}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </TeacherPanel>
    </div>
  );
}
