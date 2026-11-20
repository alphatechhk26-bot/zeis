import Link from 'next/link';
import { formatStudentDate, requireStudentContext } from '@/lib/student-dashboard';
import { StudentAssignmentSubmit } from '@/components/dashboard/student-assignment-submit';
import { StudentEmptyState, StudentPageHeader, StudentPanel } from '@/components/dashboard/student-ui';

export default async function StudentAssignmentsPage() {
  const { supabase, studentId, profile } = await requireStudentContext();

  if (!profile.school_id) {
    return (
      <div className="space-y-6">
        <StudentPageHeader title="Assignments" description="Published assignments, due dates, and your submissions." />
        <StudentEmptyState
          title="School assignment pending"
          description="Assignments will be available after your school has been assigned to your account."
        />
      </div>
    );
  }

  const { data: courses, error: courseError } = await supabase
    .from('lms_courses')
    .select('id, name')
    .eq('school_id', profile.school_id)
    .eq('is_published', true);

  if (courseError) throw new Error(`Unable to load your learning courses: ${courseError.message}`);

  const courseIds = (courses ?? []).map((course) => course.id);
  const [{ data: assignments, error: assignmentError }] =
    courseIds.length > 0
      ? await Promise.all([
          supabase
            .from('assignments')
            .select('id, title, description, due_date, max_score, course_id')
            .in('course_id', courseIds)
            .eq('is_published', true)
            .order('due_date', { ascending: true }),
        ])
      : [{ data: [], error: null }];

  if (assignmentError) throw new Error(`Unable to load published assignments: ${assignmentError.message}`);

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);
  const { data: submissions, error: submissionError } =
    assignmentIds.length > 0
      ? await supabase
          .from('submissions')
          .select('assignment_id, status, submitted_at, submission_text, grade, feedback')
          .eq('student_id', studentId)
          .in('assignment_id', assignmentIds)
      : { data: [], error: null };

  if (submissionError) throw new Error(`Unable to load your submission status: ${submissionError.message}`);

  const courseById = new Map((courses ?? []).map((course) => [course.id, course.name]));
  const submissionByAssignment = new Map((submissions ?? []).map((submission) => [submission.assignment_id, submission]));

  return (
    <div className="space-y-6">
      <StudentPageHeader
        title="Assignments"
        description="Review published coursework and submit or update your written responses."
      />
      <StudentPanel title="Published assignments" description="Assignments available in your school's published learning courses.">
        {!assignments?.length ? (
          <StudentEmptyState
            title="No published assignments"
            description="There are no assignments available in your learning courses right now."
          />
        ) : (
          <ul className="space-y-4">
            {assignments.map((assignment) => {
              const submission = submissionByAssignment.get(assignment.id);
              const status = submission?.status ?? 'not submitted';

              return (
                <li key={assignment.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{assignment.title}</h3>
                      <p className="mt-1 text-xs text-gray-400">
                        {assignment.course_id && courseById.get(assignment.course_id) ? (
                          <Link href={`/lms/course/${assignment.course_id}`} className="text-cyan-300 hover:text-cyan-200">
                            {courseById.get(assignment.course_id)}
                          </Link>
                        ) : (
                          'Course details unavailable'
                        )}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        status === 'graded'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : status === 'submitted'
                            ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                            : 'border-gray-700 bg-gray-800/60 text-gray-300'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {assignment.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{assignment.description}</p>
                  )}
                  <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-800 pt-3 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-gray-500">Due</dt>
                      <dd className="text-gray-300">{formatStudentDate(assignment.due_date)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-gray-500">Maximum score</dt>
                      <dd className="text-gray-300">{assignment.max_score}</dd>
                    </div>
                    {submission?.submitted_at && (
                      <div className="flex gap-2">
                        <dt className="text-gray-500">Submitted</dt>
                        <dd className="text-gray-300">{formatStudentDate(submission.submitted_at)}</dd>
                      </div>
                    )}
                    {submission?.grade !== null && submission?.grade !== undefined && (
                      <div className="flex gap-2">
                        <dt className="text-gray-500">Grade</dt>
                        <dd className="text-gray-300">{submission.grade}</dd>
                      </div>
                    )}
                  </dl>
                  {submission?.status === 'graded' && submission.feedback && (
                    <p className="mt-3 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-300">
                      Feedback: {submission.feedback}
                    </p>
                  )}
                  <StudentAssignmentSubmit
                    assignmentId={assignment.id}
                    initialText={submission?.submission_text ?? ''}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </StudentPanel>
    </div>
  );
}
