'use client';

import { useEffect } from 'react';

export default function StudentDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Student dashboard failed to load:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-500/20 bg-gray-900/70 p-6 text-center">
      <h2 className="text-lg font-semibold text-white">We couldn’t load this student page</h2>
      <p className="mt-2 text-sm leading-6 text-gray-400">
        Please try again. If the problem continues, contact your school administrator.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-gray-950 transition hover:bg-cyan-400"
      >
        Try again
      </button>
    </div>
  );
}
