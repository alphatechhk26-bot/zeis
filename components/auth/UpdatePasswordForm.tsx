'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setError('Password updates are unavailable because Supabase is not configured.');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        router.push('/login?message=Password updated successfully');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="landing-shell flex min-h-screen items-center justify-center px-5 py-12 text-slate-100">
      <form onSubmit={handleUpdate} className="auth-panel relative w-full max-w-md space-y-4 rounded-3xl p-6 sm:p-8">
        <div className="relative">
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-200"><LockKeyhole aria-hidden="true" className="h-5 w-5" /></div>
          <h1 className="text-2xl font-semibold text-white">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-400">Use at least 8 characters to secure your ZEIS account.</p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-950/45 px-4 py-3 text-sm text-rose-200">{error}</p>}
          <label className="mt-5 block space-y-2 text-xs font-medium text-slate-300">
            New password
            <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="auth-input px-4" />
          </label>
          <label className="mt-4 block space-y-2 text-xs font-medium text-slate-300">
            Confirm new password
            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="auth-input px-4" />
          </label>
          <button type="submit" disabled={isSubmitting} className="primary-cta mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-65">
            {isSubmitting && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Updating password…' : 'Update password'}
          </button>
          <p className="mt-5 text-center text-xs text-slate-400"><Link href="/login" className="text-cyan-300 hover:text-cyan-100">Return to sign in</Link></p>
        </div>
      </form>
    </main>
  );
}
