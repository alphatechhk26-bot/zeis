import Link from 'next/link';
import { BookOpen, Play, Presentation } from 'lucide-react';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminPageHeader,
  AdminPanel,
  AdminStatCard,
  formatAdminDate,
  renderAdminPageSafely,
} from '@/components/dashboard/admin-ui';
import { requireAdminContext } from '@/lib/admin-dashboard';

export default async function AdminLmsPage() {
  const context = await requireAdminContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Learning management" description="Review courses and published lesson resources." />
        <AdminErrorState />
      </div>
    );
  }
  const { supabase, role, schoolId } = context;

  return renderAdminPageSafely('LMS', async () => {
    if (role === 'admin' && !schoolId) {
      return (
        <div className="space-y-6">
          <AdminPageHeader title="Learning management" description="Review courses and published lesson resources." />
          <AdminEmptyState title="School assignment required" description="Your admin profile is not assigned to a school, so learning resources cannot be loaded." />
        </div>
      );
    }

    let coursesQuery = supabase
      .from('lms_courses')
      .select('id, name, description, is_published, created_at, created_by, school_id')
      .order('created_at', { ascending: false })
      .limit(500);
    if (role === 'admin' && schoolId) coursesQuery = coursesQuery.eq('school_id', schoolId);

    const { data: courses, error: courseError } = await coursesQuery;
    if (courseError) throw courseError;

    const courseIds = (courses ?? []).map((course) => course.id);
    let lessonRows: Array<{ id: string; course_id: string; is_published: boolean | null }> = [];
    if (courseIds.length > 0) {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, course_id, is_published')
        .in('course_id', courseIds);
      if (error) throw error;
      lessonRows = data ?? [];
    }

    const lessonsByCourse = new Map<string, number>();
    for (const lesson of lessonRows) {
      if (!lesson.is_published) continue;
      lessonsByCourse.set(lesson.course_id, (lessonsByCourse.get(lesson.course_id) ?? 0) + 1);
    }
    const publishedCourseCount = (courses ?? []).filter((course) => course.is_published).length;
    const publishedLessonCount = lessonRows.filter((lesson) => lesson.is_published).length;

    return (
      <div className="space-y-6">
        <AdminPageHeader title="Learning management" description="Review courses and published lesson resources within your authorized school scope." />
        <section aria-label="LMS summary" className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Loaded courses" value={String(courses?.length ?? 0)} detail="Most recent records (up to 500)" icon={BookOpen} />
          <AdminStatCard label="Published courses" value={String(publishedCourseCount)} detail="Among loaded courses" icon={Presentation} />
          <AdminStatCard label="Published lessons" value={String(publishedLessonCount)} detail="For loaded courses" icon={Play} />
        </section>
        <AdminPanel title="Course catalog" description="Courses and lesson counts from the existing LMS tables.">
          {!courses?.length ? (
            <AdminEmptyState title="No courses found" description="Courses will appear here after they are added to your school." />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <li key={course.id} className="flex flex-col rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                      <h3 className="font-medium text-white">{course.name}</h3>
                    </div>
                    <span className="rounded-full border border-gray-700 bg-gray-800/60 px-2 py-1 text-[11px] text-gray-300">
                      {course.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {course.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{course.description}</p>}
                  <p className="mt-3 text-xs text-gray-500">
                    {lessonsByCourse.get(course.id) ?? 0} published lessons · Created {formatAdminDate(course.created_at)}
                  </p>
                  {course.is_published && (
                    <Link href={`/lms/course/${course.id}`} className="mt-4 inline-flex items-center gap-2 self-start text-sm font-medium text-cyan-300 hover:text-cyan-200">
                      <Play aria-hidden="true" className="h-4 w-4" /> Open course
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>
    );
  });
}
