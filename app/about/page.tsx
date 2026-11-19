import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Cpu, Globe2, Sparkles } from 'lucide-react';

const values = [
  { title: 'Education', description: 'Support learners, educators, families and school leaders.', icon: BookOpen },
  { title: 'Technology', description: 'Use secure digital tools to connect education services.', icon: Cpu },
  { title: 'Innovation', description: 'Turn local insight and new ideas into better experiences.', icon: Sparkles },
  { title: 'Prosperity', description: 'Help widen opportunity through knowledge and learning.', icon: Globe2 },
];

export default function AboutPage() {
  return (
    <main className="landing-shell min-h-screen px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-[0.16em] text-white"><span className="brand-mark !h-9 !w-9 !rounded-xl !text-base">Z</span> ZEIS</Link>
          <Link href="/" className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100">Home</Link>
        </header>
        <section className="mt-12 rounded-[2rem] border border-cyan-200/15 bg-slate-900/55 p-6 backdrop-blur-xl sm:mt-16 sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">About ZEIS</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">A smarter future together.</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            ZEIS — the Zanzibar Education Intelligence System — brings education technology, useful information and AI-supported learning together in one connected platform. Its purpose is to support the people and institutions shaping education across Zanzibar.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {values.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-5">
                <Icon aria-hidden="true" className="h-5 w-5 text-cyan-300" />
                <h2 className="mt-4 font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </article>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/" className="secondary-cta"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Back to ZEIS</Link>
            <Link href="/agent" className="primary-cta">Meet the Zanzibar AI Agent<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
