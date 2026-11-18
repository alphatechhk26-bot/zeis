'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Bot,
  Cpu,
  GraduationCap,
  Lightbulb,
  Sparkles,
} from 'lucide-react';

interface SuperAdminOverviewGridProps {
  activeSchools: number;
  enrollment: number;
  supabaseOnline: boolean;
}

const QUICK_PROMPTS = [
  'Summarize global enrollment trends',
  'Find schools that may need attention',
  'Review the platform health signals',
];

const TELEMETRY = {
  '24H': [36, 58, 44, 72, 53, 88, 67, 94],
  '7D': [52, 68, 61, 82, 74, 91, 77, 96],
  '30D': [42, 57, 65, 53, 78, 70, 89, 84],
} as const;

type TelemetryWindow = keyof typeof TELEMETRY;

const cardClassName =
  'group relative flex min-h-[290px] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-5 shadow-[0_0_24px_rgba(14,165,233,0.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_32px_rgba(34,211,238,0.16)]';

function CardGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/[0.06] via-transparent to-indigo-500/[0.08] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
    />
  );
}

function QuickActionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="mt-auto inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/10"
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}

export function SuperAdminOverviewGrid({
  activeSchools,
  enrollment,
  supabaseOnline,
}: SuperAdminOverviewGridProps) {
  const [telemetryWindow, setTelemetryWindow] = useState<TelemetryWindow>('24H');
  const [selectedBar, setSelectedBar] = useState(7);
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);
  const telemetryBars = TELEMETRY[telemetryWindow];
  const selectedPrompt = QUICK_PROMPTS[selectedPromptIndex];

  const openAssistant = (prompt: string) => {
    window.dispatchEvent(
      new CustomEvent('zeis:open-ai-assistant', {
        detail: { prompt },
      })
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className={cardClassName}>
        <CardGlow />
        <div className="relative flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2.5 text-cyan-200">
              <GraduationCap aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Education
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white">Education network</h2>
          <p className="mt-1 text-sm text-slate-400">Live reach across the Zanzibar school system.</p>

          <div className="my-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-500">Active schools</p>
              <p className="mt-1 text-2xl font-semibold text-white">{activeSchools.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
              <p className="text-xs text-slate-500">Enrollment</p>
              <p className="mt-1 text-2xl font-semibold text-white">{enrollment.toLocaleString()}</p>
            </div>
          </div>

          <QuickActionLink href="/dashboard/super-admin/schools">Manage schools</QuickActionLink>
        </div>
      </article>

      <article className={cardClassName}>
        <CardGlow />
        <div className="relative flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between">
            <div className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-2.5 text-indigo-200">
              <Cpu aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
              Technology
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white">Platform systems</h2>
          <p className="mt-1 text-sm text-slate-400">Infrastructure and service indicators.</p>

          <div className="my-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2.5">
              <span className="text-sm text-slate-300">Supabase</span>
              <span className={`inline-flex items-center gap-2 text-xs font-medium ${supabaseOnline ? 'text-emerald-300' : 'text-rose-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${supabaseOnline ? 'animate-pulse bg-emerald-400' : 'bg-rose-400'}`} />
                {supabaseOnline ? 'Connected' : 'Degraded'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-2.5">
              <span className="text-sm text-slate-300">Dashboard API</span>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Online
              </span>
            </div>
          </div>
          <QuickActionLink href="/dashboard/super-admin/settings">Configure system</QuickActionLink>
        </div>
      </article>

      <article className={cardClassName}>
        <CardGlow />
        <div className="relative flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between">
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-2.5 text-amber-200">
              <Lightbulb aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              Innovation
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white">Platform telemetry</h2>
          <p className="mt-1 text-sm text-slate-400">Interactive activity signal overview.</p>

          <div className="my-4 flex gap-1.5" role="group" aria-label="Telemetry time range">
            {(Object.keys(TELEMETRY) as TelemetryWindow[]).map((range) => (
              <button
                key={range}
                type="button"
                aria-pressed={telemetryWindow === range}
                onClick={() => {
                  setTelemetryWindow(range);
                  setSelectedBar(7);
                }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  telemetryWindow === range
                    ? 'bg-cyan-400/15 text-cyan-200'
                    : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="flex h-16 items-end gap-1.5" role="group" aria-label={`${telemetryWindow} activity bars`}>
            {telemetryBars.map((value, index) => (
              <button
                key={`${telemetryWindow}-${index}`}
                type="button"
                aria-label={`Activity point ${index + 1}: ${value}%`}
                aria-pressed={selectedBar === index}
                onClick={() => setSelectedBar(index)}
                className="group/bar flex h-full flex-1 items-end rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span
                  className={`block w-full rounded-t-sm transition-all ${
                    selectedBar === index
                      ? 'bg-gradient-to-t from-indigo-500 to-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                      : 'bg-gradient-to-t from-blue-900 to-cyan-500/70 group-hover/bar:from-indigo-500 group-hover/bar:to-cyan-300'
                  }`}
                  style={{ height: `${value}%` }}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Selected signal <span className="font-medium text-cyan-200">{telemetryBars[selectedBar]}%</span>
          </p>

          <QuickActionLink href="/dashboard/super-admin/analytics">Explore intelligence reports</QuickActionLink>
        </div>
      </article>

      <article className={`${cardClassName} border-indigo-400/25 hover:border-indigo-300/45`}>
        <CardGlow />
        <div className="relative flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2.5 text-cyan-200">
              <Bot aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
              Agent online
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white">Zanzibar AI Agent</h2>
          <p className="mt-1 text-sm text-slate-400">Choose a command to open the assistant with a ready prompt.</p>

          <div className="my-4 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                aria-pressed={selectedPromptIndex === index}
                onClick={() => setSelectedPromptIndex(index)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                  selectedPromptIndex === index
                    ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                    : 'border-slate-700/80 bg-slate-950/40 text-slate-400 hover:border-cyan-400/30 hover:text-cyan-100'
                }`}
              >
                {prompt}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openAssistant(selectedPrompt)}
            className="mt-auto inline-flex w-fit items-center gap-2 rounded-lg border border-indigo-300/30 bg-gradient-to-r from-indigo-500/20 to-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
          >
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Open AI assistant
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </article>
    </div>
  );
}
