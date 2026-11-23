import type { ReactNode } from 'react';
import { unstable_rethrow } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">ZEIS Command · Admin</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{description}</p>
    </header>
  );
}

export function AdminPanel({
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

export function AdminEmptyState({
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

function getAdminErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return 'ZEIS could not load this information. Please try again later.';
  }

  const code = error.code;
  if (code === '42501' || code === 'PGRST301') {
    return 'Your account does not have permission to view this information.';
  }
  if (code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205') {
    return 'The database schema for this page is unavailable or out of date. Please contact your ZEIS administrator.';
  }
  return 'ZEIS could not load this information. Please try again later.';
}

export function AdminErrorState({
  title = 'Unable to load this page',
  error,
}: {
  title?: string;
  error?: unknown;
}) {
  return (
    <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-6">
      <p className="font-medium text-amber-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-400">{error ? getAdminErrorMessage(error) : 'Please try again shortly.'}</p>
    </div>
  );
}

export async function renderAdminPageSafely(
  pageName: string,
  render: () => Promise<ReactNode>,
) {
  try {
    return await render();
  } catch (error) {
    unstable_rethrow(error);
    console.error(`Unable to render admin ${pageName} page:`, error);
    return <AdminErrorState error={error} />;
  }
}

export function AdminStatCard({
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

export function formatAdminDate(value: string | null) {
  if (!value) return 'Not specified';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatAdminCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(value);
}
