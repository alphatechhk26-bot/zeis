import type { ReactNode } from 'react';
import { unstable_rethrow } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export function ParentPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">ZEIS Command · Parent</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{description}</p>
    </header>
  );
}

export function ParentPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ParentEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-950/50 px-5 py-8 text-center">
      <p className="font-medium text-gray-200">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-400">{description}</p>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'ZEIS could not load this information. Please try again later.';
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return 'Your account does not have permission to view this information.';
  }
  if (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST205') {
    return 'The database schema for this page is unavailable or out of date. Please contact your ZEIS administrator.';
  }
  return 'ZEIS could not load this information. Please try again later.';
}

export function ParentErrorState({
  title = 'Unable to load this page',
  error,
}: {
  title?: string;
  error?: unknown;
}) {
  return (
    <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-6">
      <p className="font-medium text-amber-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-400">
        {error ? getErrorMessage(error) : 'Please try again shortly.'}
      </p>
    </div>
  );
}

export async function renderParentPageSafely(
  pageName: string,
  render: () => Promise<ReactNode>,
) {
  try {
    return await render();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Unable to render parent ${pageName} page:`, error);
    return <ParentErrorState error={error} />;
  }
}

export function ParentStatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <Icon aria-hidden="true" className="h-5 w-5 text-cyan-300" />
      </div>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}
