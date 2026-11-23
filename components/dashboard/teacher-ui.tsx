import type { ReactNode } from 'react';

export function TeacherPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Teacher workspace</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">{description}</p>
    </header>
  );
}

export function TeacherPanel({
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

export function TeacherEmptyState({
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
