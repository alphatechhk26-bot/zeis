import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Play, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

function safeVideoUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function LmsCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?redirectedFrom=${encodeURIComponent(`/lms/course/${courseId}`)}`);

  const { data: course, error: courseError } = await supabase
    .from('lms_courses')
    .select('id, name, description')
    .eq('id', courseId)
    .eq('is_published', true)
    .single();

  if (courseError || !course) notFound();

  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id, title, content, video_url, order_index')
    .eq('course_id', course.id)
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (lessonsError) {
    throw new Error(`Unable to load course lessons: ${lessonsError.message}`);
  }

  return (
    <main className="landing-shell min-h-screen px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-white"><span className="brand-mark !h-9 !w-9 !rounded-xl !text-base">Z</span> ZEIS</Link>
          <Link href="/explore/learn" className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100">Learning library</Link>
        </header>
        <section className="mt-12 rounded-[2rem] border border-cyan-200/15 bg-slate-900/55 p-6 backdrop-blur-xl sm:mt-16 sm:p-10">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300"><BookOpen aria-hidden="true" className="h-4 w-4" /> ZEIS learning</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{course.name}</h1>
          {course.description && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{course.description}</p>}
          <h2 className="mt-9 text-lg font-semibold text-white">Published lessons</h2>
          {lessons.length === 0 ? (
            <p className="mt-4 rounded-xl border border-white/[0.08] bg-slate-950/40 p-4 text-sm text-slate-400">There are no published lessons in this course yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {lessons.map((lesson, index) => {
                const videoUrl = safeVideoUrl(lesson.video_url);
                return (
                  <li key={lesson.id} className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">Lesson {index + 1}</p>
                    <h3 className="mt-2 font-semibold text-white">{lesson.title}</h3>
                    {lesson.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{lesson.content}</p>}
                    {videoUrl && <a href={videoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100"><Play aria-hidden="true" className="h-3.5 w-3.5" />Open lesson video</a>}
                  </li>
                );
              })}
            </ol>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/explore/learn" className="secondary-cta"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to courses</Link>
            <Link href="/agent" className="primary-cta"><Sparkles aria-hidden="true" className="h-4 w-4" />Ask the AI Tutor</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
