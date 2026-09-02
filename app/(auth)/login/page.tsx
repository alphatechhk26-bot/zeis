// app/(auth)/login/page.tsx
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, resetPassword, type AuthState } from '@/actions/auth';
import Link from 'next/link';

// ----------------------------------------------------------------------
// Login Component
// ----------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const [isResetMode, setIsResetMode] = useState(false);

  // useActionState returns [state, dispatch, isPending]
  const [state, dispatch, isPending] = useActionState<AuthState, FormData>(
    isResetMode ? resetPassword : signIn,
    { error: undefined, success: false, message: '' }
  );

  // Redirect to dashboard on successful sign‑in
  useEffect(() => {
    if (state.success && !isResetMode) {
      router.push('/dashboard');
    }
  }, [state.success, isResetMode, router]);

  // Toggle between sign‑in and reset password modes
  const toggleMode = () => {
    setIsResetMode((prev) => !prev);
    // Reset the state to clear old messages
    // (useActionState doesn't provide a direct reset; we'll just let it be)
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isResetMode ? 'Reset your password' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isResetMode
              ? 'Enter your email and we\'ll send you a reset link.'
              : 'Or '}
            {!isResetMode && (
              <button
                type="button"
                onClick={toggleMode}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                reset your password
              </button>
            )}
          </p>
        </div>

        <form className="mt-8 space-y-6" action={dispatch}>
          {/* Display global error or success message */}
          {state.error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{state.error}</p>
            </div>
          )}
          {state.success && state.message && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-700">{state.message}</p>
            </div>
          )}

          {isResetMode ? (
            // Reset password form – only email required
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
          ) : (
            // Sign‑in form – email + password
            <>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {isResetMode ? 'Sending...' : 'Signing in...'}
                </>
              ) : (
                isResetMode ? 'Send reset link' : 'Sign in'
              )}
            </button>
          </div>

          {/* Optional: link to sign up page */}
          {!isResetMode && (
            <div className="text-sm text-center">
              <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
                Don't have an account? Sign up
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}