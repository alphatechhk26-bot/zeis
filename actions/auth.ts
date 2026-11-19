// actions/auth.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type AuthState = {
  error?: string;
  success?: boolean;
  message?: string;
};

// ----------------------------------------------------------------------
// Sign In
// ----------------------------------------------------------------------

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  const supabase = await createClient({ rememberMe: formData.get('remember-me') === 'on' });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return { error: 'Please confirm your email address using the link we sent before signing in.' };
    }
    if (/invalid login credentials/i.test(error.message)) {
      return { error: 'The email or password is incorrect. Please try again.' };
    }
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    const { error: signOutError } = await supabase.auth.signOut();
    return {
      error: signOutError
        ? 'Unable to load your account profile or end the session. Please try again.'
        : 'Unable to load your account profile. Please contact support.',
    };
  }

  revalidatePath('/dashboard', 'layout');
  const requestedPath = String(formData.get('redirectedFrom') ?? '');
  const safeRequestedPath =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//') && !requestedPath.includes('\\')
      ? requestedPath
      : '';
  const roleDashboard = {
    super_admin: '/dashboard/super-admin',
    admin: '/dashboard/admin',
    teacher: '/dashboard/teacher',
    student: '/dashboard/student',
    parent: '/dashboard/parent',
  } as const;
  redirect(safeRequestedPath || roleDashboard[profile.role]);
}

// ----------------------------------------------------------------------
// Sign Up
// ----------------------------------------------------------------------

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('full_name') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();

  // Include user metadata (will be used by the trigger to create profile)
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || '',
        // Default role is 'student' – the trigger will assign it.
        // If you want to allow role selection, pass it here.
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is enabled, the user will receive a confirmation email.
  // We can return a message.
  return {
    success: true,
    message: 'Check your email to confirm your account.',
  };
}

// ----------------------------------------------------------------------
// Sign Out
// ----------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Server‑side redirect after sign out
  redirect('/login');
}

// ----------------------------------------------------------------------
// Reset Password (send reset email)
// ----------------------------------------------------------------------

export async function resetPassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    return { error: 'Email is required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  const supabase = await createClient();
  const requestHeaders = await headers();
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  const forwardedHost = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const origin =
    configuredOrigin ??
    (forwardedHost
      ? `${requestHeaders.get('x-forwarded-proto') ?? 'https'}://${forwardedHost}`
      : 'http://localhost:3000');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: 'Password reset email sent. Check your inbox.',
  };
}