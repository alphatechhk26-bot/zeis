import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const sections = {
  learn: {
    title: 'Learn',
    eyebrow: 'Knowledge for every learner',
    description: 'Explore learning materials shared through ZEIS and discover how digital resources can support learning across Zanzibar.',
    points: ['Learning materials and course resources', 'Teacher-led classroom learning', 'AI-supported explanations and study guidance'],
  },
  innovate: {
    title: 'Innovate',
    eyebrow: 'Ideas that move education forward',
    description: 'ZEIS connects people, data and digital tools so schools and communities can turn new ideas into better learning experiences.',
    points: ['Experiment with new approaches to learning', 'Share ideas across education communities', 'Use insight to guide informed decisions'],
  },
  create: {
    title: 'Create',
    eyebrow: 'Make knowledge actionable',
    description: 'Support educators and learners as they shape learning content, lessons and practical ideas for their own communities.',
    points: ['Plan lessons and learning activities', 'Create clear, accessible learning materials', 'Use the AI Agent to brainstorm and refine ideas'],
  },
  transform: {
    title: 'Transform',
    eyebrow: 'A connected digital education system',
    description: 'Bring school information and education workflows together with digital tools designed to support the people behind every classroom.',
    points: ['Connect school operations and learning', 'Make education information easier to use', 'Build digital confidence through practical technology'],
  },
  impact: {
    title: 'Impact',
    eyebrow: 'Progress with purpose',
    description: 'ZEIS helps education communities understand progress and focus attention on outcomes that make a difference for learners.',
    points: ['Follow learning and school progress', 'Use evidence to inform decisions', 'Strengthen opportunities for Zanzibar communities'],
  },
  education: {
    title: 'Education',
    eyebrow: 'Learning is at the heart of ZEIS',
    description: 'A digital education ecosystem can help learners, families, educators and school leaders stay connected to the work of learning.',
    points: ['Learning resources and classroom support', 'Student progress and school information', 'Inclusive opportunities for lifelong learning'],
  },
  technology: {
    title: 'Technology',
    eyebrow: 'Useful technology, built around people',
    description: 'ZEIS brings secure digital services and AI-enabled support into an education experience designed for Zanzibar.',
    points: ['A secure, role-aware education portal', 'Digital tools for education workflows', 'AI assistance designed to support learning'],
  },
  innovation: {
    title: 'Innovation',
    eyebrow: 'Curiosity creates possibility',
    description: 'Innovation connects local insight with thoughtful experimentation to help education services keep evolving.',
    points: ['Encourage practical problem-solving', 'Give educators room to explore new approaches', 'Share promising ideas across communities'],
  },
  development: {
    title: 'Development',
    eyebrow: 'Growing skills and opportunity',
    description: 'Education, digital capability and collaboration can help strengthen opportunities for people and communities across Zanzibar.',
    points: ['Develop digital and learning skills', 'Support educators and institutions', 'Connect learning with future opportunity'],
  },
  prosperity: {
    title: 'Prosperity',
    eyebrow: 'Education for a brighter future',
    description: 'By supporting learning and opportunity, ZEIS contributes to a more capable, connected and prosperous Zanzibar.',
    points: ['Expand access to useful learning', 'Help communities make informed choices', 'Build a future shaped by knowledge and opportunity'],
  },
} as const;

type Section = keyof typeof sections;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

export const dynamicParams = false;

export default async function ExploreSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionParam } = await params;
  if (!(sectionParam in sections)) notFound();
  const section = sectionParam as Section;
  const content = sections[section];

  let courses: Array<{
    id: string;
    name: string;
    description: string | null;
    thumbnail_url: string | null;
  }> = [];
  let courseError = '';
  let signedIn = false;

  if (section === 'learn') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) {
      const { data, error } = await supabase
        .from('lms_courses')
        .select('id, name, description, thumbnail_url')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) {
        courseError = 'We could not load course resources for this account right now.';
      } else {
        courses = data ?? [];
      }
    }
  }

  return (
    <main className="landing-shell min-h-screen px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-white">
            <span className="brand-mark !h-9 !w-9 !rounded-xl !text-base">Z</span> ZEIS
          </Link>
          <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100">Home</Link>
        </header>

        <section className="mt-12 rounded-[2rem] border border-cyan-200/15 bg-slate-900/55 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:mt-16 sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">{content.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{content.description}</p>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {content.points.map((point) => (
              <li key={point} className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-4 text-sm leading-6 text-slate-300">
                <Sparkles aria-hidden="true" className="mb-3 h-4 w-4 text-cyan-300" />
                {point}
              </li>
            ))}
          </ul>

          {section === 'learn' && (
            <section id="learning-resources" aria-labelledby="resources-heading" className="mt-10 border-t border-white/[0.08] pt-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Your learning library</p>
                  <h2 id="resources-heading" className="mt-2 text-xl font-semibold text-white">Course resources</h2>
                </div>
                {!signedIn && <Link href="/login" className="secondary-cta">Sign in to view your courses <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
              </div>
              {courseError && <p role="alert" className="mt-5 rounded-xl border border-rose-300/20 bg-rose-950/35 p-4 text-sm text-rose-200">{courseError}</p>}
              {signedIn && !courseError && courses.length === 0 && (
                <p className="mt-5 rounded-xl border border-white/[0.08] bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
                  No course resources are currently available to this account. Your school&apos;s courses appear here when they are shared with your ZEIS profile.
                </p>
              )}
              {courses.length > 0 && (
                <ul className="mt-5 grid gap-4 md:grid-cols-2">
                  {courses.map((course) => {
                    return (
                      <li key={course.id} className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-5">
                        <BookOpen aria-hidden="true" className="h-5 w-5 text-cyan-300" />
                        <h3 className="mt-3 font-semibold text-white">{course.name}</h3>
                        {course.description && <p className="mt-2 text-sm leading-6 text-slate-400">{course.description}</p>}
                        <Link href={`/lms/course/${course.id}`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-100">Open course<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/agent" className="primary-cta"><Sparkles aria-hidden="true" className="h-4 w-4" />Explore the Zanzibar AI Agent<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            <Link href="/" className="secondary-cta"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to ZEIS</Link>
          </div>
        </section>
        <footer className="mt-8 text-center text-xs text-slate-500">Zanzibar Education Intelligence System</footer>
      </div>
    </main>
  );
}
