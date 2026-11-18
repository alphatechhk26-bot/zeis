'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('full_name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'student',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage('Your account has been created. Check your email to confirm your address.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'We could not create your account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-950 text-slate-100 lg:grid-cols-2">
      <aside aria-label="ZEIS AI education portal" className="relative hidden min-h-screen overflow-hidden lg:block">
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
          className="absolute inset-y-0 right-0 z-10 w-[30%] bg-gradient-to-l from-slate-950 via-slate-950/50 to-transparent"
        />
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

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/65 p-6 shadow-[0_0_60px_rgba(14,165,233,0.12)] backdrop-blur-md sm:p-8">
          <div className="mb-7">
            <h2 className="text-xl font-semibold text-white">Create your account</h2>
            <p className="mt-1 text-sm text-slate-400">Join the ZEIS intelligent education portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-rose-400/30 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
              >
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div
                role="status"
                className="rounded-lg border border-emerald-400/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
              >
                {successMessage}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-300">
                Full Name
              </label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email Address
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
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  placeholder="Create a password"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(14,165,233,0.28)] transition hover:shadow-[0_0_34px_rgba(34,211,238,0.48)] focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-700/70 pt-5 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-cyan-300 transition hover:text-cyan-200 hover:drop-shadow-[0_0_8px_rgba(103,232,249,0.65)]"
            >
              Sign in
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
