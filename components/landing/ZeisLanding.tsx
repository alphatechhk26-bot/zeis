'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Cpu,
  Eye,
  EyeOff,
  Globe2,
  GraduationCap,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Menu,
  Network,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { signIn, type AuthState } from '@/actions/auth';

const primaryLinks = [
  { label: 'Learn', href: '/explore/learn' },
  { label: 'Innovate', href: '/explore/innovate' },
  { label: 'Create', href: '/explore/create' },
  { label: 'Transform', href: '/explore/transform' },
  { label: 'Impact', href: '/explore/impact' },
];

const focusAreas = [
  { label: 'Education', href: '/explore/education', icon: GraduationCap },
  { label: 'Technology', href: '/explore/technology', icon: Cpu },
  { label: 'Innovation', href: '/explore/innovation', icon: Sparkles },
  { label: 'Development', href: '/explore/development', icon: Network },
  { label: 'Prosperity', href: '/explore/prosperity', icon: Globe2 },
];

const pillars = [
  { title: 'Learn', detail: 'Learning resources', icon: BookOpen, href: '/explore/learn' },
  { title: 'Innovate', detail: 'Ideas into action', icon: Sparkles, href: '/explore/innovate' },
  { title: 'Create', detail: 'Build learning content', icon: Layers3, href: '/explore/create' },
  { title: 'Transform', detail: 'Education, reimagined', icon: Cpu, href: '/explore/transform' },
  { title: 'Impact', detail: 'Progress that matters', icon: Globe2, href: '/explore/impact' },
];

export default function ZeisLanding() {
  const [showPassword, setShowPassword] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const [state, dispatch, isPending] = useActionState<AuthState, FormData>(signIn, {
    error: undefined,
    success: false,
    message: '',
  });

  return (
    <main className="landing-shell min-h-screen overflow-hidden text-slate-100">
      <div aria-hidden="true" className="landing-grid pointer-events-none fixed inset-0" />
      <div aria-hidden="true" className="landing-orb landing-orb-blue pointer-events-none fixed" />
      <div aria-hidden="true" className="landing-orb landing-orb-violet pointer-events-none fixed" />

      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="ZEIS homepage" className="group flex items-center gap-3">
          <span className="brand-mark">Z</span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-[0.18em] text-white">ZEIS</span>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">
              Zanzibar Education Intelligence System
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((item) => (
            <Link key={item.label} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
          <Link href="/about" className="nav-link">About ZEIS</Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/agent" className="nav-agent">
            <BrainCircuit aria-hidden="true" className="h-4 w-4" />
            Zanzibar AI Agent
          </Link>
          <Link href="/sign-up" className="nav-join">Join ZEIS <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 lg:hidden"
        >
          {menuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <nav aria-label="Mobile navigation" className="relative z-20 mx-5 mb-4 grid gap-1 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden">
          {[...primaryLinks, { label: 'About ZEIS', href: '/about' }, { label: 'Zanzibar AI Agent', href: '/agent' }].map((item) => (
            <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-slate-200 transition hover:bg-cyan-300/10 hover:text-cyan-100">
              {item.label}
            </Link>
          ))}
          <Link href="/sign-up" onClick={() => setMenuOpen(false)} className="mt-1 rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-bold text-slate-950">
            Create an account
          </Link>
        </nav>
      )}

      <section className="relative z-10 mx-auto grid max-w-[1440px] items-center gap-8 px-5 pb-10 pt-4 sm:px-8 lg:min-h-[650px] lg:grid-cols-[minmax(0,1.18fr)_minmax(370px,0.82fr)] lg:gap-10 lg:px-12 lg:pb-12 lg:pt-3">
        <div className="relative flex min-h-[510px] flex-col justify-center lg:min-h-[590px]">
          <div className="hero-portrait absolute inset-0 overflow-hidden rounded-[2rem]" aria-hidden="true">
            <Image
              src="/ai-bg.png"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover object-center opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#060b16]/95 via-[#060b16]/62 to-[#060b16]/15 lg:from-[#060b16]/90 lg:via-[#060b16]/48 lg:to-[#060b16]/5" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060b16] via-transparent to-[#060b16]/20" />
          </div>
          <div className="relative z-10 max-w-2xl px-2 py-10 sm:px-7 lg:px-8">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/[0.07] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100 sm:text-xs">
              <span className="status-dot" />
              Zanzibar&apos;s education intelligence platform
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              A smarter future,
              <span className="hero-gradient block">built together.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Connecting learning, technology and insight to help every education community in Zanzibar move forward.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/agent" className="primary-cta">
                <BrainCircuit aria-hidden="true" className="h-4 w-4" />
                Meet the Zanzibar AI Agent
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href="/about" className="secondary-cta">
                Discover ZEIS
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-300 sm:text-xs">
              {primaryLinks.map((item, index) => (
                <span key={item.label} className="flex items-center gap-3">
                  <Link href={item.href} className="transition hover:text-cyan-200">{item.label}</Link>
                  {index < primaryLinks.length - 1 && <span aria-hidden="true" className="text-cyan-400/70">•</span>}
                </span>
              ))}
            </div>

            <Link href="/about" className="mt-7 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-cyan-200">
              <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
              A smarter future together
            </Link>
          </div>
          <div aria-hidden="true" className="hero-chip absolute bottom-6 right-4 hidden items-center gap-3 rounded-2xl border border-cyan-200/20 bg-slate-950/55 px-4 py-3 backdrop-blur-xl sm:flex lg:right-8">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles className="h-4 w-4" /></span>
            <span><span className="block text-xs font-semibold text-white">Intelligence for impact</span><span className="text-[10px] text-slate-400">Rooted in Zanzibar</span></span>
          </div>
        </div>

        <section aria-labelledby="sign-in-heading" className="auth-panel relative z-10 mx-auto w-full max-w-[470px] rounded-[1.75rem] p-6 sm:p-8 lg:my-auto">
          <div aria-hidden="true" className="auth-panel-glow" />
          <div className="relative">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Secure portal access</p>
                <h2 id="sign-in-heading" className="text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
                <p className="mt-1.5 text-sm text-slate-400">Sign in to continue to your ZEIS workspace.</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-200"><LockKeyhole aria-hidden="true" className="h-5 w-5" /></span>
            </div>

            <form action={dispatch} className="space-y-4">
              <input type="hidden" name="redirectedFrom" value={searchParams.get('redirectedFrom') ?? ''} />
              {state.error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-950/45 px-4 py-3 text-sm leading-5 text-rose-200">{state.error}</div>}
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-300">Email address</span>
                <span className="relative block">
                  <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="auth-input pl-11 pr-4" />
                </span>
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-300">Password</span>
                <span className="relative block">
                  <ShieldCheck aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Enter your password" className="auth-input pl-11 pr-12" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-0 grid place-items-center px-3.5 text-slate-500 transition hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                    {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              <div className="flex items-center justify-between gap-3 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-400">
                  <input name="remember-me" type="checkbox" className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400/40" />
                  Remember me
                </label>
                <Link href="/forgot-password" className="font-medium text-cyan-300 transition hover:text-cyan-100">Forgot password?</Link>
              </div>
              <button type="submit" disabled={isPending} className="primary-cta w-full justify-center disabled:cursor-not-allowed disabled:opacity-65">
                {isPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {isPending ? 'Signing in…' : 'Sign in securely'}
                {!isPending && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              New to ZEIS? <Link href="/sign-up" className="font-semibold text-cyan-300 hover:text-cyan-100">Create an account</Link>
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-cyan-400" />
              Protected by ZEIS secure access
            </div>
          </div>
        </section>
      </section>

      <section aria-label="ZEIS platform pillars" className="relative z-10 mx-auto max-w-[1440px] px-5 pb-14 sm:px-8 lg:px-12 lg:pb-16">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">One connected ecosystem</p>
          <Link href="/about" className="hidden items-center gap-1.5 text-xs text-cyan-300 transition hover:text-cyan-100 sm:inline-flex">A smarter future together <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {pillars.map(({ title, detail, icon: Icon, href }, index) => (
            <Link key={title} href={href} className="pillar-card group">
              <span className="flex items-center justify-between">
                <span className="pillar-icon"><Icon aria-hidden="true" className="h-4 w-4" /></span>
                <span className="text-[9px] font-semibold tracking-[0.16em] text-slate-600">0{index + 1}</span>
              </span>
              <span className="mt-4 flex items-center justify-between gap-2">
                <span><span className="block text-sm font-semibold text-white">{title}</span><span className="mt-1 block text-xs text-slate-400">{detail}</span></span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] bg-slate-950/35">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5 text-[10px] text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p className="font-medium uppercase tracking-[0.16em]">Zanzibar Education Intelligence System</p>
          <nav aria-label="ZEIS focus areas" className="flex flex-wrap gap-x-4 gap-y-2">
            {focusAreas.map(({ label, href }) => <Link key={label} href={href} className="transition hover:text-cyan-200">{label}</Link>)}
          </nav>
          <Link href="/about" className="transition hover:text-cyan-200">A smarter future together</Link>
        </div>
      </footer>
    </main>
  );
}
