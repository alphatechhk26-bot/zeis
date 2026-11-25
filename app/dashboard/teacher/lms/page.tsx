import { TeacherLmsManager } from '@/components/dashboard/teacher-lms-manager';
import {
  renderTeacherPageSafely,
  TeacherErrorState,
  TeacherPageHeader,
  TeacherPanel,
} from '@/components/dashboard/teacher-ui';
import { getTeacherAssignmentOptions, requireTeacherContext } from '@/lib/teacher-dashboard';

export default async function TeacherLmsPage() {
  const context = await requireTeacherContext();
  if ('error' in context) {
    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Learning management" description="Create and manage courses and lessons for your assigned classes." />
        <TeacherErrorState />
      </div>
    );
  }

  return renderTeacherPageSafely('LMS', async () => {
    const assignments = await getTeacherAssignmentOptions(context);
    const assignedClassSubjects = new Set(assignments.map((item) => `${item.classId}:${item.subjectId}`));
    const { data: courseRecords, error: courseError } = await context.supabase.from('lms_courses')
      .select('id, name, description, is_published, class_id, subject_id')
      .eq('school_id', context.schoolId)
      .eq('created_by', context.teacherId)
      .order('created_at', { ascending: false });
    if (courseError) throw new Error(`Unable to load your courses: ${courseError.message}`);

    const validCourses = (courseRecords ?? []).filter((course) =>
      course.class_id && course.subject_id && assignedClassSubjects.has(`${course.class_id}:${course.subject_id}`)
    );
    const courseIds = validCourses.map((course) => course.id);
    const { data: lessons, error: lessonError } = courseIds.length
      ? await context.supabase.from('lessons')
          .select('id, course_id, title, content, video_url, is_published, order_index')
          .in('course_id', courseIds)
          .order('order_index', { ascending: true })
      : { data: [], error: null };
    if (lessonError) throw new Error(`Unable to load course lessons: ${lessonError.message}`);

    const courseAssignments = new Map(
      assignments.map((assignment) => [`${assignment.classId}:${assignment.subjectId}`, assignment]),
    );
    const lessonsByCourse = new Map<string, typeof lessons>();
    for (const lesson of lessons ?? []) {
      const current = lessonsByCourse.get(lesson.course_id) ?? [];
      current.push(lesson);
      lessonsByCourse.set(lesson.course_id, current);
    }
    const courses = validCourses.flatMap((course) => {
      if (!course.class_id || !course.subject_id) return [];
      const assignment = courseAssignments.get(`${course.class_id}:${course.subject_id}`);
      if (!assignment) return [];
      return [{
        id: course.id,
        name: course.name,
        description: course.description,
        isPublished: course.is_published,
        className: assignment.className,
        subjectName: assignment.subjectName,
        lessons: (lessonsByCourse.get(course.id) ?? []).map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
          videoUrl: lesson.video_url,
          isPublished: lesson.is_published,
          orderIndex: lesson.order_index,
        })),
      }];
    });

    return (
      <div className="space-y-6">
        <TeacherPageHeader title="Learning management" description="Create and manage courses and lessons for your assigned classes." />
        <TeacherPanel title="Your learning materials" description="Courses and lessons are scoped to your own teacher account and verified class-subject assignments.">
          <TeacherLmsManager assignments={assignments} courses={courses} />
        </TeacherPanel>
      </div>
    );
  });
}
