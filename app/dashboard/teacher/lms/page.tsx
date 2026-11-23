import Link from 'next/link';
import { BookOpen, Play } from 'lucide-react';
import { TeacherEmptyState, TeacherPageHeader, TeacherPanel } from '@/components/dashboard/teacher-ui';
import { requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherLmsPage() {
  const { supabase, teacherId, schoolId } = await requireTeacherContext();

  if (!schoolId) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Learning management" description="Courses and learning resources available to your school." />
        <TeacherEmptyState title="School assignment pending" description="Learning resources will appear after a school is assigned to your account." />
      </div>
    );
  }

  const { data: courses, error: courseError } = await supabase
    .from('lms_courses')
    .select('id, name, description, is_published')
    .eq('school_id', schoolId)
    .or(`is_published.eq.true,created_by.eq.${teacherId}`)
    .order('created_at', { ascending: false });
  if (courseError) throw new Error(`Unable to load school learning resources: ${courseError.message}`);

  const courseIds = (courses ?? []).map((course) => course.id);
  const { data: lessons, error: lessonError } =
    courseIds.length > 0
      ? await supabase.from('lessons').select('id, course_id').in('course_id', courseIds).eq('is_published', true)
      : { data: [], error: null };
  if (lessonError) throw new Error(`Unable to load published lesson counts: ${lessonError.message}`);

  const lessonCountByCourse = new Map<string, number>();
  for (const lesson of lessons ?? []) {
    lessonCountByCourse.set(lesson.course_id, (lessonCountByCourse.get(lesson.course_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <TeacherPageHeader title="Learning management" description="Browse your courses and published resources available to your school." />
      <TeacherPanel title="Learning resources" description="Published school courses and courses you created.">
        {!courses?.length ? (
          <TeacherEmptyState title="No learning resources" description="Published courses and your own courses will appear here." />
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
                      {course.is_published ? ' · Published' : ' · Your draft'}
                    </p>
                  </div>
                </div>
                {course.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{course.description}</p>}
                {course.is_published ? (
                  <Link
                    href={`/lms/course/${course.id}`}
                    className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
                  >
                    <Play aria-hidden="true" className="h-4 w-4" />
                    Open course
                  </Link>
                ) : (
                  <p className="mt-5 text-xs text-gray-500">Publish this course to make it available to learners.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </TeacherPanel>
    </div>
  );
}
