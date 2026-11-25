'use client';

import { FormEvent, useState } from 'react';
import {
  createTeacherCourse,
  createTeacherLesson,
  updateTeacherCourse,
  updateTeacherLesson,
} from '@/actions/teacher-workspace';

type AssignmentOption = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  academicYearId: string;
  academicYearName: string;
};

type LessonRow = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  isPublished: boolean | null;
  orderIndex: number;
};
type CourseRow = {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean | null;
  className: string;
  subjectName: string;
  lessons: LessonRow[];
};

function Feedback({ error, notice }: { error: string | null; notice: string | null }) {
  if (!error && !notice) return null;
  return (
    <p role={error ? 'alert' : 'status'} className={`mt-2 text-xs ${error ? 'text-red-300' : 'text-emerald-300'}`}>
      {error ?? notice}
    </p>
  );
}

function CourseEditor({ course }: { course: CourseRow }) {
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description ?? '');
  const [published, setPublished] = useState(Boolean(course.isPublished));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateTeacherCourse({ courseId: course.id, name, description, isPublished: published });
      setNotice('Course updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update course.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-2 border-b border-gray-800 pb-4">
      <label className="block text-xs text-gray-500">Course name
        <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100" />
      </label>
      <label className="block text-xs text-gray-500">Description
        <textarea maxLength={5000} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-100" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="accent-cyan-400" />
          Publish course
        </label>
        <button disabled={busy} className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save course'}
        </button>
      </div>
      <Feedback error={error} notice={notice} />
    </form>
  );
}

function LessonEditor({ courseId, lesson }: { courseId: string; lesson?: LessonRow }) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '');
  const [published, setPublished] = useState(Boolean(lesson?.isPublished));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (lesson) {
        await updateTeacherLesson({ lessonId: lesson.id, title, content, videoUrl, isPublished: published });
      } else {
        await createTeacherLesson({ courseId, title, content, videoUrl, isPublished: published });
        setTitle('');
        setContent('');
        setVideoUrl('');
        setPublished(false);
      }
      setNotice(lesson ? 'Lesson updated.' : 'Lesson added.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save lesson.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
      <p className="text-sm font-medium text-gray-200">{lesson ? `Lesson ${lesson.orderIndex}` : 'Add lesson'}</p>
      <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Lesson title" className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" />
      <textarea maxLength={20000} rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Lesson content / instructions" className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" />
      <input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="Optional video URL" className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100" />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="accent-cyan-400" />
          Publish lesson
        </label>
        <button disabled={busy} className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">
          {busy ? 'Saving…' : lesson ? 'Save lesson' : 'Add lesson'}
        </button>
      </div>
      <Feedback error={error} notice={notice} />
    </form>
  );
}

export function TeacherLmsManager({
  assignments,
  courses,
}: {
  assignments: AssignmentOption[];
  courses: CourseRow[];
}) {
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState(
    assignments[0] ? `${assignments[0].classId}:${assignments[0].subjectId}:${assignments[0].academicYearId}` : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedAssignment = assignments.find((assignment) =>
    `${assignment.classId}:${assignment.subjectId}:${assignment.academicYearId}` === selectedAssignmentKey
  ) ?? assignments[0];

  const createCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createTeacherCourse({
        classId: String(form.get('classId')),
        subjectId: String(form.get('subjectId')),
        academicYearId: String(form.get('academicYearId')),
        name: String(form.get('name')),
        description: String(form.get('description') || ''),
      });
      setNotice('Course created as a draft.');
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create course.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <p role={error ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
          {error ?? notice}
        </p>
      )}
      {!assignments.length ? (
        <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">
          A valid class-subject assignment is required before creating a course.
        </p>
      ) : (
        <form onSubmit={createCourse} className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950/50 p-4 md:grid-cols-2">
          <h3 className="font-medium text-white md:col-span-2">Create course</h3>
          <label className="text-xs text-gray-400">Class, subject, and year
            <select name="assignment" required className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" onChange={(event) => {
              setSelectedAssignmentKey(event.target.value);
            }} value={selectedAssignmentKey}>
              {assignments.map((assignment) => (
                <option key={`${assignment.classId}:${assignment.subjectId}:${assignment.academicYearId}`} value={`${assignment.classId}:${assignment.subjectId}:${assignment.academicYearId}`}>
                  {assignment.className} · {assignment.subjectName} · {assignment.academicYearName}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="classId" value={selectedAssignment?.classId ?? ''} readOnly />
          <input type="hidden" name="subjectId" value={selectedAssignment?.subjectId ?? ''} readOnly />
          <input type="hidden" name="academicYearId" value={selectedAssignment?.academicYearId ?? ''} readOnly />
          <label className="text-xs text-gray-400">Course name
            <input name="name" required maxLength={200} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </label>
          <label className="text-xs text-gray-400 md:col-span-2">Description
            <textarea name="description" rows={2} maxLength={5000} className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100" />
          </label>
          <button disabled={busy} className="justify-self-start rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-cyan-400 disabled:opacity-50">
            {busy ? 'Creating…' : '+ Create course'}
          </button>
        </form>
      )}

      <section className="space-y-4">
        {!courses.length ? (
          <p className="rounded-xl border border-dashed border-gray-700 px-5 py-8 text-center text-sm text-gray-400">You have not created any courses yet.</p>
        ) : courses.map((course) => (
          <article key={course.id} className="space-y-4 rounded-xl border border-gray-800 bg-gray-950/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white">{course.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{course.className} · {course.subjectName} · {course.isPublished ? 'Published' : 'Draft'}</p>
              </div>
            </div>
            <CourseEditor course={course} />
            <div className="grid gap-3 lg:grid-cols-2">
              {course.lessons.map((lesson) => <LessonEditor key={lesson.id} courseId={course.id} lesson={lesson} />)}
              <LessonEditor courseId={course.id} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
