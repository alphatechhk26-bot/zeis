'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { resetPassword, type AuthState } from '@/actions/auth';

export default function ForgotPasswordPage() {
  const [state, dispatch, isPending] = useActionState<AuthState, FormData>(resetPassword, {
    error: undefined,
    success: false,
    message: '',
  });

  return (
    <main className="landing-shell flex min-h-screen items-center justify-center px-5 py-12 text-slate-100">
      <section className="auth-panel relative w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="relative">
          <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-200">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to sign in
          </Link>
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Enter your account email and we&apos;ll send a secure password reset link.</p>

          <form action={dispatch} className="mt-7 space-y-4">
            {state.error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-950/45 px-4 py-3 text-sm text-rose-200">{state.error}</p>}
            {state.success && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-950/35 px-4 py-3 text-sm leading-6 text-emerald-200">{state.message}</p>}
            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-300">Email address</span>
              <span className="relative block">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="auth-input pl-11 pr-4" />
              </span>
            </label>
            <button type="submit" disabled={isPending} className="primary-cta w-full justify-center disabled:cursor-not-allowed disabled:opacity-65">
              {isPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {isPending ? 'Sending link…' : 'Send reset link'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
