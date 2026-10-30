"use client";

import { useTicketsStore } from "@store/tickets.store";
import { usePortalStore } from "@store/portal.store";
import { useMemo } from "react";

export function PortalQuickStats() {
  const { tickets } = useTicketsStore();
  const { deflectionCount, setActiveTab } = usePortalStore();

  const metrics = useMemo(() => {
    let active = 0;
    let actionNeeded = 0;
    let resolved = 0;

    for (const ticket of tickets) {
      if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") {
        active += 1;
      } else if (
        ticket.status === "NEEDS_INFO" ||
        (ticket.status === "RESOLVED" && !ticket.csatRating)
      ) {
        actionNeeded += 1;
      } else if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
        resolved += 1;
      }
    }

    return { active, actionNeeded, resolved };
  }, [tickets]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Active Tickets */}
      <div className="bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800 border-l-4 border-l-spruce-600 dark:border-l-spruce-400 rounded-xl p-3 sm:p-4 shadow-xs transition-all">
        <div className="flex items-center justify-between">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-300">
            Active Tickets
          </p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200">
            In Queue
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold font-mono text-spruce-950 dark:text-white"
          >
            {metrics.active}
          </span>
        </div>
        <p
          suppressHydrationWarning
          className="mt-1 text-[11px] sm:text-xs text-spruce-600 dark:text-spruce-400 truncate"
        >
          {metrics.active === 1
            ? "1 request in progress"
            : `${metrics.active} requests in progress`}
        </p>
      </div>

      {/* 2. Action Needed / Pending Confirmation */}
      <div
        className={`bg-white dark:bg-spruce-900/90 border rounded-xl p-3 sm:p-4 shadow-xs transition-all border-l-4 ${
          metrics.actionNeeded > 0
            ? "border-spruce-200 dark:border-spruce-800 border-l-amber-500 dark:border-l-amber-400"
            : "border-spruce-200 dark:border-spruce-800 border-l-spruce-500 dark:border-l-spruce-400"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-300">
            Action Needed
          </p>
          {metrics.actionNeeded > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 animate-pulse">
              Needs Input
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold font-mono text-spruce-950 dark:text-white"
          >
            {metrics.actionNeeded}
          </span>
        </div>
        <p
          suppressHydrationWarning
          className="mt-1 text-[11px] sm:text-xs text-spruce-600 dark:text-spruce-400 truncate"
        >
          {metrics.actionNeeded > 0
            ? "Feedback / info requested"
            : "Queue clear and current"}
        </p>
      </div>

      {/* 3. Resolved & Closed */}
      <div className="bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800 border-l-4 border-l-emerald-600 dark:border-l-emerald-400 rounded-xl p-3 sm:p-4 shadow-xs transition-all">
        <div className="flex items-center justify-between">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-300">
            Resolved
          </p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
            Complete
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold font-mono text-spruce-950 dark:text-white"
          >
            {metrics.resolved}
          </span>
        </div>
        <p className="mt-1 text-[11px] sm:text-xs text-spruce-600 dark:text-spruce-400 truncate">
          Successfully resolved
        </p>
      </div>

      {/* 4. Self-Service KB Deflections */}
      <div className="bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800 border-l-4 border-l-spruce-700 dark:border-l-spruce-300 rounded-xl p-3 sm:p-4 shadow-xs transition-all">
        <div className="flex items-center justify-between">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-300">
            Knowledge Base
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("knowledge-base")}
            className="text-[11px] font-semibold text-spruce-700 hover:text-spruce-950 dark:text-spruce-300 dark:hover:text-white hover:underline cursor-pointer"
          >
            Browse &rarr;
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-extrabold font-mono text-spruce-950 dark:text-white"
          >
            {deflectionCount > 0 ? `${deflectionCount} Solved` : "10 Guides"}
          </span>
        </div>
        <p
          suppressHydrationWarning
          className="mt-1 text-[11px] sm:text-xs text-spruce-600 dark:text-spruce-400 truncate"
        >
          {deflectionCount > 0
            ? "Saved from ticket queue"
            : "Instant self-service answers"}
        </p>
      </div>
    </div>
  );
}
