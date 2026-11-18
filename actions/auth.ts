// actions/auth.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/zeis';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type AuthState = {
  error?: string;
  success?: boolean;
  message?: string;
};

// ----------------------------------------------------------------------
// Helper: extract user metadata from form data
// ----------------------------------------------------------------------

function getMetadata(formData: FormData): Partial<Database['public']['Tables']['profiles']['Insert']> {
  return {
    full_name: (formData.get('full_name') as string) || null,
    // Add other fields if needed (e.g., avatar_url, role)
  };
}

// ----------------------------------------------------------------------
// Sign In
// ----------------------------------------------------------------------

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
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
  redirect(profile.role === 'super_admin' ? '/dashboard/super-admin' : '/dashboard');
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
  const { data, error } = await supabase.auth.signUp({
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
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: 'Password reset email sent. Check your inbox.',
  };
}