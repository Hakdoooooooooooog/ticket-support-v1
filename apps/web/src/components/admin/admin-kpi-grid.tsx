'use client';

import * as React from 'react';
import { Card, CardContent } from '@ui/card';
import { ContextualLoader } from '@ui/contextual-loader';

export interface AdminKpis {
  urgentHigh: number;
  open: number;
  inProgress: number;
  needsInfo: number;
  resolvedClosed: number;
  total: number;
  csatAverage: number | null;
  csatCount: number;
}

interface AdminKpiGridProps {
  kpis: AdminKpis;
  unassignedCount: number;
  myAssignedCount: number;
  isLoading?: boolean;
  onFilterUrgent: () => void;
  onFilterUnassigned: () => void;
  onFilterMyAssigned: () => void;
  onFilterAllTickets: () => void;
}

export function AdminKpiGrid({
  kpis,
  unassignedCount,
  myAssignedCount,
  isLoading,
  onFilterUrgent,
  onFilterUnassigned,
  onFilterMyAssigned,
  onFilterAllTickets,
}: AdminKpiGridProps) {
  if (isLoading) {
    return <ContextualLoader context="admin-kpi" />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
      {/* 1. Critical & Urgent Incidents (Highest Priority) */}
      <Card
        onClick={onFilterUrgent}
        className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
      >
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
              Urgent / High
            </p>
            {kpis.urgentHigh > 0 && (
              <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                Critical
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {kpis.urgentHigh}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            {kpis.urgentHigh > 0 ? 'Production blockers active' : 'No critical incidents'}
          </p>
        </CardContent>
      </Card>

      {/* 2. Unassigned Queue (High Priority Triage) */}
      <Card
        onClick={onFilterUnassigned}
        className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
      >
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
              Unassigned Queue
            </p>
            {unassignedCount > 0 && (
              <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Triage
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {unassignedCount}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            {unassignedCount > 0 ? 'Awaiting engineer claim' : 'Queue fully triaged'}
          </p>
        </CardContent>
      </Card>

      {/* 3. Assigned to Me (Personal Focus) */}
      <Card
        onClick={onFilterMyAssigned}
        className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
      >
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
              Assigned to Me
            </p>
            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-spruce-100 text-spruce-700 dark:bg-spruce-800 dark:text-spruce-300 border border-spruce-200 dark:border-spruce-700">
              Active
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {myAssignedCount}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            My personal incidents
          </p>
        </CardContent>
      </Card>

      {/* 4. Customer Satisfaction Score (Quality KPI) */}
      <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
              CSAT Score
            </p>
            <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-spruce-100 text-spruce-700 dark:bg-spruce-800 dark:text-spruce-300 border border-spruce-200 dark:border-spruce-700">
              KPI
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {kpis.csatAverage ? `${kpis.csatAverage} / 5.0` : 'N/A'}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            {kpis.csatCount > 0
              ? `${kpis.csatCount} ${kpis.csatCount === 1 ? 'review recorded' : 'reviews recorded'}`
              : 'Awaiting reviews'}
          </p>
        </CardContent>
      </Card>

      {/* 5. In Progress / Needs Info (Operational Workflow) */}
      <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
        <CardContent className="p-3.5 space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
            In Progress / Info
          </p>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {kpis.inProgress + kpis.needsInfo}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            Active investigations
          </p>
        </CardContent>
      </Card>

      {/* 6. Resolved / Closed (Completed Work) */}
      <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
        <CardContent className="p-3.5 space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
            Resolved / Closed
          </p>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {kpis.resolvedClosed}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            Closed incidents
          </p>
        </CardContent>
      </Card>

      {/* 7. Total Queue Baseline */}
      <Card
        onClick={onFilterAllTickets}
        className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors col-span-2 sm:col-span-3 lg:col-span-2 2xl:col-span-1 shadow-sm"
      >
        <CardContent className="p-3.5 space-y-1">
          <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
            Total Tickets
          </p>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
            {kpis.total}
          </p>
          <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
            All incidents in desk
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
