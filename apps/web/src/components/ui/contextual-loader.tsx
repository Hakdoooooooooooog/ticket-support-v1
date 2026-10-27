'use client';

import * as React from 'react';
import { Card, CardHeader, CardContent } from '@ui/card';

export type LoaderContextType =
  | 'auth-session'
  | 'portal-auth'
  | 'admin-auth'
  | 'customer-tickets'
  | 'admin-queue'
  | 'admin-kpi'
  | 'ticket-submission'
  | 'triage-update'
  | 'comment-post'
  | 'ticket-delete';

interface ContextualLoaderProps {
  context: LoaderContextType;
  label?: string;
  sublabel?: string;
  count?: number;
}

/**
 * Context-aware loading animation component that renders a distinct visual
 * animation and structural skeleton tailored to the specific data domain.
 */
export function ContextualLoader({
  context,
  label,
  sublabel,
  count = 3,
}: ContextualLoaderProps) {
  switch (context) {
    case 'auth-session':
    case 'portal-auth':
    case 'admin-auth':
      return (
        <AuthSessionLoader
          variant={context}
          label={label}
          sublabel={sublabel}
        />
      );
    case 'customer-tickets':
      return <CustomerTicketsLoader count={count} label={label} />;
    case 'admin-kpi':
      return <AdminKpiTelemetryLoader />;
    case 'admin-queue':
      return <AdminQueueTriageLoader count={count} label={label} />;
    case 'ticket-submission':
      return <TicketTransactionPipelineLoader label={label} />;
    case 'triage-update':
    case 'comment-post':
    case 'ticket-delete':
      return <InlineMutationBadgeLoader variant={context} label={label} />;
    default:
      return null;
  }
}

/**
 * 1. AUTHENTICATION & PASSPORT JWT SESSION LOADER
 * Displays an orbital cryptographic shield animation with role-specific status steps.
 */
function AuthSessionLoader({
  variant,
  label,
  sublabel,
}: {
  variant: 'auth-session' | 'portal-auth' | 'admin-auth';
  label?: string;
  sublabel?: string;
}) {
  const isAdmin = variant === 'admin-auth';
  const isPortal = variant === 'portal-auth';

  const defaultTitle = isAdmin
    ? 'Opening Admin Console'
    : isPortal
      ? 'Opening Support Portal'
      : 'Signing In';

  const defaultSub = isAdmin
    ? 'Checking account permissions and loading the ticket queue...'
    : isPortal
      ? 'Loading your account and recent support requests...'
      : 'Checking your session and loading your workspace...';

  const accentRing = isAdmin
    ? 'border-indigo-500/40 border-t-indigo-500'
    : isPortal
      ? 'border-emerald-500/40 border-t-emerald-500'
      : 'border-blue-500/40 border-t-blue-500';

  const badgeTone = isAdmin
    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
    : isPortal
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

  return (
    <main
      role="status"
      aria-live="polite"
      data-testid={`loader-${variant}`}
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
    >
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 p-8 shadow-xl backdrop-blur text-center space-y-6">
        {/* Orbital Cryptographic Shield */}
        <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-2 ${accentRing} animate-orbit`}
          />
          <div className="absolute inset-2 rounded-full border border-dashed border-slate-300 dark:border-slate-700 animate-pulse" />
          <div className="relative h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center shadow-inner">
            <svg
              className="h-5 w-5 text-slate-700 dark:text-slate-200 animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${badgeTone}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
            {isAdmin
              ? 'Admin Console'
              : isPortal
                ? 'Customer Portal'
                : 'Account Session'}
          </span>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {label || defaultTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {sublabel || defaultSub}
          </p>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center gap-1">
            <span className="h-1.5 w-8 rounded-full bg-blue-500 animate-pulse" />
            <span>1. Account</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center gap-1">
            <span className="h-1.5 w-8 rounded-full bg-indigo-500 animate-pulse" />
            <span>2. Access</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center gap-1">
            <span className="h-1.5 w-8 rounded-full bg-emerald-500 animate-pulse" />
            <span>3. Workspace</span>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * 2. CUSTOMER PORTAL TICKET STREAM LOADER
 * Renders a customer-centric timeline skeleton with radar sync indicator and
 * staggered ticket cards matching the Customer Portal layout.
 */
function CustomerTicketsLoader({
  count = 3,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loader-customer-tickets"
      className="space-y-4"
    >
      {/* Contextual Sync Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-blue-200/70 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
            {label || 'Loading your tickets and recent replies...'}
          </span>
        </div>
      </div>

      {/* Staggered Customer Ticket Card Skeletons */}
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          className="animate-shimmer border-slate-200/80 dark:border-slate-800/80"
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="flex gap-1.5 shrink-0">
                <div className="h-5 w-14 rounded-full bg-amber-500/20 dark:bg-amber-500/15 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-blue-500/20 dark:bg-blue-500/15 animate-pulse" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/90 animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800/90 animate-pulse" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 3. ADMIN KPI TELEMETRY EQUALIZER LOADER
 * Renders 5 metric cards with animated equalizer bars while SLA metrics compute.
 */
function AdminKpiTelemetryLoader() {
  const kpiMeta = [
    { label: 'Total Tickets', color: 'bg-slate-400' },
    { label: 'Open Queue', color: 'bg-amber-500' },
    { label: 'In Progress', color: 'bg-blue-500' },
    { label: 'Urgent / High', color: 'bg-red-500' },
    { label: 'Resolved / Closed', color: 'bg-emerald-500' },
  ];

  return (
    <div
      role="status"
      aria-label="Loading SLA KPI metrics"
      data-testid="loader-admin-kpi"
      className="grid grid-cols-2 sm:grid-cols-5 gap-4"
    >
      {kpiMeta.map((item, idx) => (
        <Card
          key={item.label}
          className={`animate-shimmer ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase">
                {item.label}
              </p>
              <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            {/* Equalizer Telemetry Bars */}
            <div className="flex items-end gap-1 h-7">
              <span className={`w-1 h-5 rounded-full ${item.color} animate-bar-1`} />
              <span className={`w-1 h-7 rounded-full ${item.color} animate-bar-2`} />
              <span className={`w-1 h-4 rounded-full ${item.color} animate-bar-3`} />
              <span className={`w-1 h-6 rounded-full ${item.color} animate-bar-4`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 4. ADMIN TRIAGE QUEUE & SLA MATRIX LOADER
 * Renders a command-center queue skeleton with triage dropdown controls
 * (Status, Priority, Assignee), incident description, and resolution note composer.
 */
function AdminQueueTriageLoader({
  count = 3,
  label,
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loader-admin-queue"
      className="space-y-4"
    >
      {/* Telemetry Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-lg border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30">
        <div className="flex items-center gap-3">
          <div className="flex items-end gap-0.5 h-4">
            <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bar-1" />
            <span className="w-1 h-4 bg-indigo-500 rounded-full animate-bar-2" />
            <span className="w-1 h-2.5 bg-indigo-500 rounded-full animate-bar-3" />
          </div>
          <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            {label || 'Loading service desk queue and team assignments...'}
          </span>
        </div>
      </div>

      {/* Command-Center Triage Row Skeletons */}
      {Array.from({ length: count }).map((_, idx) => (
        <Card
          key={idx}
          className="animate-shimmer border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 rounded font-mono bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-5 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-red-500/20 animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-amber-500/20 animate-pulse" />
                </div>
                <div className="h-3 w-72 rounded bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
              </div>

              {/* Simulated Status / Priority / Assignee Select Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-8 w-28 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 animate-pulse" />
                <div className="h-8 w-28 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 animate-pulse" />
                <div className="h-8 w-40 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 animate-pulse" />
                <div className="h-8 w-16 rounded-md bg-red-500/15 animate-pulse" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-4">
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded-md bg-slate-100 dark:bg-slate-900 animate-pulse" />
              <div className="h-8 w-24 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 5. TICKET SUBMISSION TRANSACTION PIPELINE LOADER
 * Shown inside the TicketForm while a new ticket is being validated, checked for
 * duplicates, and committed inside a Prisma database transaction.
 */
function TicketTransactionPipelineLoader({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loader-ticket-submission"
      className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/40 space-y-2.5 animate-shimmer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-orbit" />
          <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
            {label || 'Submitting your support ticket...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        <div className="px-2 py-1 rounded bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Details</span>
        </div>
        <div className="px-2 py-1 rounded bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
          <span>Attachment</span>
        </div>
        <div className="px-2 py-1 rounded bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
          <span>Queue</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 6. INLINE MUTATION BADGE LOADER
 * Compact contextual status pill for live ticket triage updates, comment posts, or deletions.
 */
function InlineMutationBadgeLoader({
  variant,
  label,
}: {
  variant: 'triage-update' | 'comment-post' | 'ticket-delete';
  label?: string;
}) {
  const config = {
    'triage-update': {
      defaultText: 'Saving changes...',
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    },
    'comment-post': {
      defaultText: 'Posting note...',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    },
    'ticket-delete': {
      defaultText: 'Deleting ticket...',
      tone: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    },
  }[variant];

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid={`loader-${variant}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.tone}`}
    >
      <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-orbit" />
      <span>{label || config.defaultText}</span>
    </span>
  );
}
