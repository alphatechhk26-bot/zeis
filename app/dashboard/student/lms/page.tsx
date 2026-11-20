import Link from 'next/link';
import { BookOpen, Play } from 'lucide-react';
import { requireStudentContext } from '@/lib/student-dashboard';
import { StudentEmptyState, StudentPageHeader, StudentPanel } from '@/components/dashboard/student-ui';

export default async function StudentLmsPage() {
  const { supabase, profile } = await requireStudentContext();

  if (!profile.school_id) {
    return (
      <div className="space-y-6">
        <StudentPageHeader title="Learning management" description="Open published courses and continue your learning." />
        <StudentEmptyState
          title="School assignment pending"
          description="School learning courses will appear after your account has been assigned to a school."
        />
      </div>
    );
  }

  const { data: courses, error: courseError } = await supabase
    .from('lms_courses')
    .select('id, name, description')
    .eq('school_id', profile.school_id)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (courseError) throw new Error(`Unable to load published courses: ${courseError.message}`);

  const courseIds = (courses ?? []).map((course) => course.id);
  const { data: lessons, error: lessonError } =
    courseIds.length > 0
      ? await supabase
          .from('lessons')
          .select('id, course_id')
          .in('course_id', courseIds)
          .eq('is_published', true)
      : { data: [], error: null };

  if (lessonError) throw new Error(`Unable to load course lessons: ${lessonError.message}`);
  const lessonCountByCourse = new Map<string, number>();
  for (const lesson of lessons ?? []) {
    lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Learning management" description="Browse published courses and their learning materials." />
      <StudentPanel title="Available courses" description="Published courses at your school.">
        {!courses?.length ? (
          <StudentEmptyState
            title="No published courses"
            description="Your school has not published any learning courses yet."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-col rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <div className="flex items-start gap-3">
                  <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{course.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {lessonCountByCourse.get(course.id) ?? 0} published lessons
                    </p>
                  </div>
                </div>
                {course.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{course.description}</p>
                )}
                <Link
                  href={`/lms/course/${course.id}`}
                  className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                >
                  <Play aria-hidden="true" className="h-4 w-4" />
                  Open course
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StudentPanel>
    </div>
  );
}
