'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Info, LoaderCircle, Mail, ShieldCheck, X } from 'lucide-react';
import { signIn, type AuthState } from '@/actions/auth';

const HERO_FEATURES = {
  agent: {
    label: 'Zanzibar AI Agent',
    title: 'AI-powered analytics',
    description:
      'The Zanzibar AI Agent turns education data into useful signals, helping administrators spot trends and make informed decisions.',
    position: 'left-[42%] top-[12%]',
  },
  zeis: {
    label: 'ZEIS',
    title: 'A connected student portal',
    description:
      'ZEIS brings learning resources, student progress, and school information together in one accessible digital portal.',
    position: 'bottom-[17%] left-[34%]',
  },
  education: {
    label: 'Education and Technology',
    title: 'Smart administration',
    description:
      'Integrated education technology helps school teams coordinate services, monitor activity, and support their communities.',
    position: 'bottom-[31%] right-[12%]',
  },
} as const;

type HeroFeatureKey = keyof typeof HERO_FEATURES;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [activeFeature, setActiveFeature] = useState<HeroFeatureKey | null>(null);
  const [state, dispatch, isPending] = useActionState<AuthState, FormData>(
    signIn,
    { error: undefined, success: false, message: '' }
  );

  useEffect(() => {
    if (!activeFeature) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveFeature(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFeature]);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-950 text-slate-100 lg:grid-cols-2">
      <aside aria-label="ZEIS AI education portal" className="hidden min-h-screen lg:block">
        <div className="relative min-h-screen w-full overflow-hidden">
          <Image
            src="/ai-bg.png"
            alt="Zanzibar AI Agent and ZEIS education intelligence system"
            fill
            priority
            sizes="50vw"
            className="h-full w-full object-cover object-left"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[30%] bg-gradient-to-l from-slate-950 via-slate-950/50 to-transparent"
          />

          {(Object.keys(HERO_FEATURES) as HeroFeatureKey[]).map((featureKey) => {
            const feature = HERO_FEATURES[featureKey];
            const isActive = activeFeature === featureKey;

            return (
              <button
                key={featureKey}
                type="button"
                aria-label={`Learn about ${feature.label}`}
                aria-controls="login-hero-feature-info"
                aria-expanded={isActive}
                onClick={() => setActiveFeature(isActive ? null : featureKey)}
                className={`group absolute ${feature.position} z-20 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-200/70 bg-slate-950/70 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-md transition hover:scale-110 hover:border-cyan-100 hover:bg-cyan-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
              >
                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-cyan-200/40 opacity-50" />
                <Info aria-hidden="true" className="relative h-4 w-4" />
              </button>
            );
          })}

          <section
            id="login-hero-feature-info"
            hidden={!activeFeature}
            aria-live="polite"
            aria-label="ZEIS feature information"
            className="absolute inset-x-5 bottom-5 z-30 rounded-2xl border border-cyan-300/25 bg-slate-950/75 p-5 pr-14 shadow-[0_0_36px_rgba(14,165,233,0.16)] backdrop-blur-xl sm:inset-x-8 sm:bottom-8 sm:p-6 sm:pr-16"
          >
            {activeFeature && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  {HERO_FEATURES[activeFeature].label}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {HERO_FEATURES[activeFeature].title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                  {HERO_FEATURES[activeFeature].description}
                </p>
                <button
                  type="button"
                  aria-label="Close feature information"
                  onClick={() => setActiveFeature(null)}
                  className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </>
            )}
          </section>
        </div>
      </aside>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 sm:px-6 lg:px-10 xl:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.07) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-12 h-80 w-80 rounded-full bg-blue-600/20 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-cyan-500/15 blur-[140px]" />

        <section className="relative z-10 w-full max-w-md">
        <header className="mb-8 text-center lg:hidden">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-2xl font-black text-cyan-200 shadow-[0_0_32px_rgba(34,211,238,0.2)]">
            Z
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">
            AI-Powered Smart Portal
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.3)]">
              ZEIS
            </span>
            <span className="text-slate-300"> - Zanzibar Education</span>
            <span className="block text-slate-300">Intelligence System</span>
          </h1>
        </header>

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/65 p-6 shadow-[0_0_60px_rgba(14,165,233,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-7">
            <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
            <p className="mt-1 text-sm text-slate-400">Access your intelligent education portal.</p>
          </div>

          <form action={dispatch} className="space-y-5">
            {state.error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-400/30 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
              >
                {state.error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <ShieldCheck aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950/70 py-3 pl-10 pr-12 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500 transition hover:text-cyan-200 focus:outline-none focus-visible:text-cyan-200"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden="true" className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-slate-400">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-2 focus:ring-cyan-400/40 focus:ring-offset-0"
                />
                Remember me
              </label>
              <Link
                href="/update-password"
                className="font-medium text-cyan-300 transition hover:text-cyan-200 hover:drop-shadow-[0_0_8px_rgba(103,232,249,0.65)]"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-cyan-300/40 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(14,165,233,0.28)] transition hover:shadow-[0_0_34px_rgba(34,211,238,0.48)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-700/70 pt-5 text-center text-sm text-slate-400">
            New to ZEIS?{' '}
            <Link
              href="/sign-up"
              className="font-semibold text-cyan-300 transition hover:text-cyan-200 hover:drop-shadow-[0_0_8px_rgba(103,232,249,0.65)]"
            >
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs tracking-wide text-slate-600">
          SECURE ACCESS <span className="px-1 text-cyan-700">/</span> ZEIS INTELLIGENCE NETWORK
        </p>
      </section>
      </section>
    </main>
  );
}
