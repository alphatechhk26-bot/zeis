import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen, BrainCircuit, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const roleHome = {
  super_admin: '/dashboard/super-admin',
  admin: '/dashboard/admin',
  teacher: '/dashboard/teacher',
  student: '/dashboard/student',
  parent: '/dashboard/parent',
} as const;

const roleDescriptions = {
  admin: {
    title: 'School administration',
    description: 'Your ZEIS workspace brings school operations, education information and digital support together.',
  },
  teacher: {
    title: 'Teaching workspace',
    description: 'Use ZEIS learning resources and AI-supported tools to help plan and support learning.',
  },
  student: {
    title: 'Student workspace',
    description: 'Continue your learning with course resources, academic results and AI-supported study help.',
  },
  parent: {
    title: 'Family workspace',
    description: 'Stay connected to learning resources and the education support available through ZEIS.',
  },
} as const;

type DashboardRole = keyof typeof roleHome;

export default async function RoleDashboardPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: roleParam } = await params;
  if (!(roleParam in roleHome)) redirect('/login');

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?redirectedFrom=${encodeURIComponent(`/dashboard/${roleParam}`)}`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) redirect('/login?error=profile_not_found');

  const actualRole = profile.role as DashboardRole;
  if (actualRole !== roleParam) redirect(roleHome[actualRole]);
  if (actualRole === 'super_admin') redirect(roleHome.super_admin);
  const content = roleDescriptions[actualRole];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 px-5 py-8 text-slate-100 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">ZEIS secure workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{actualRole.replace('_', ' ')}</p>
        <section className="mt-8 rounded-3xl border border-cyan-200/10 bg-slate-900/55 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white">{content.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{content.description}</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <Link href="/explore/learn" className="group rounded-2xl border border-white/[0.08] bg-slate-950/50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/35">
              <BookOpen aria-hidden="true" className="h-5 w-5 text-cyan-300" />
              <span className="mt-4 flex items-center justify-between gap-3">
                <span><span className="block font-semibold text-white">Learning library</span><span className="mt-1 block text-xs text-slate-400">Open courses and published resources</span></span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-cyan-300 transition group-hover:translate-x-1" />
              </span>
            </Link>
            <Link href="/agent" className="group rounded-2xl border border-white/[0.08] bg-slate-950/50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/35">
              <BrainCircuit aria-hidden="true" className="h-5 w-5 text-cyan-300" />
              <span className="mt-4 flex items-center justify-between gap-3">
                <span><span className="block font-semibold text-white">Zanzibar AI Agent</span><span className="mt-1 block text-xs text-slate-400">Open the ZEIS AI Tutor</span></span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-cyan-300 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-cyan-400" />Your role and access are verified by ZEIS.</p>
        </section>
      </div>
    </main>
  );
}
