"use client";

import { Button } from "@ui/button";
import { AuthUser } from "@lib/helpers";
import type { AdminSection } from "@store/admin.store";
import { useState } from "react";

interface AdminBottomNavProps {
  user: AuthUser | null;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  unassignedCount: number;
  myAssignedCount: number;
  urgentCount: number;
  onOpenMobileDrawer: () => void;
  onRefresh: () => void;
  onFilterUnassigned: () => void;
  onFilterUrgent: () => void;
  onOpenInviteSubtab: () => void;
}

export function AdminBottomNav({
  user,
  activeSection,
  onSelectSection,
  unassignedCount,
  myAssignedCount,
  urgentCount,
  onOpenMobileDrawer,
  onRefresh,
  onFilterUnassigned,
  onFilterUrgent,
  onOpenInviteSubtab,
}: AdminBottomNavProps) {
  const [isQuickActionSheetOpen, setIsQuickActionSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile Bottom Navigation Bar (<lg) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-spruce-950/95 backdrop-blur-md border-t border-spruce-200/90 dark:border-spruce-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe select-none"
      >
        <div className="grid grid-cols-5 items-center justify-around h-16 max-w-lg mx-auto px-2">
          {/* Tab 1: Overview / Dashboard */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("DASHBOARD");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === "DASHBOARD"
                ? "text-spruce-950 dark:text-spruce-100 font-bold"
                : "text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium"
            }`}
          >
            <div className="relative">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={activeSection === "DASHBOARD" ? 2.25 : 1.75}
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Overview</span>
          </button>

          {/* Tab 2: Queue / All Tickets */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("ALL_TICKETS");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === "ALL_TICKETS"
                ? "text-spruce-950 dark:text-spruce-100 font-bold"
                : "text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium"
            }`}
          >
            <div className="relative">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={activeSection === "ALL_TICKETS" ? 2.25 : 1.75}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              {unassignedCount > 0 && (
                <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none text-white bg-amber-500 rounded-full shadow-xs">
                  {unassignedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Queue</span>
          </button>

          {/* Tab 3: Center Elevated Floating Quick Action (+) Button */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <button
              type="button"
              onClick={() => setIsQuickActionSheetOpen(true)}
              aria-label="Open quick actions menu"
              className="w-12 h-12 rounded-full bg-spruce-800 hover:bg-spruce-900 text-spruce-100 dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950 shadow-lg shadow-spruce-950/25 flex items-center justify-center border-4 border-spruce-50 dark:border-spruce-950 active:scale-95 transition-transform"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            <span className="text-[10px] mt-1 font-semibold text-spruce-700 dark:text-spruce-300 tracking-tight">
              Actions
            </span>
          </div>

          {/* Tab 4: Assigned to Me */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("ASSIGNED_TICKETS");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === "ASSIGNED_TICKETS"
                ? "text-spruce-950 dark:text-spruce-100 font-bold"
                : "text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium"
            }`}
          >
            <div className="relative">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={
                    activeSection === "ASSIGNED_TICKETS" ? 2.25 : 1.75
                  }
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {myAssignedCount > 0 && (
                <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none text-white bg-spruce-700 dark:bg-spruce-400 dark:text-spruce-950 rounded-full shadow-xs">
                  {myAssignedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Assigned</span>
          </button>

          {/* Tab 5: Full Menu / More Drawer */}
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            aria-label="Open full navigation drawer"
            className="flex flex-col items-center justify-center py-1 rounded-xl transition-all text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Quick Actions Bottom Sheet Modal (<lg) */}
      {isQuickActionSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsQuickActionSheetOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-spruce-950/70 backdrop-blur-sm flex flex-col justify-end p-3 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-spruce-900 rounded-2xl p-5 space-y-4 shadow-2xl border border-spruce-200 dark:border-spruce-800 max-w-md w-full mx-auto"
          >
            <div className="flex items-center justify-between border-b border-spruce-100 dark:border-spruce-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-300 flex items-center justify-center">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-spruce-950 dark:text-white">
                  Quick IT Actions
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickActionSheetOpen(false)}
                className="p-1 rounded-md text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors"
                aria-label="Close quick actions"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Action 1: Refresh Queue */}
              <button
                type="button"
                onClick={() => {
                  onRefresh();
                  setIsQuickActionSheetOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-spruce-100 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-200 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">
                    Refresh Incident Queue
                  </div>
                  <div className="text-[11px] text-spruce-500">
                    Fetch newest customer reports & status updates
                  </div>
                </div>
              </button>

              {/* Action 2: Triage Unassigned Incidents */}
              <button
                type="button"
                onClick={() => {
                  onFilterUnassigned();
                  setIsQuickActionSheetOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">
                    Triage Unassigned ({unassignedCount})
                  </div>
                  <div className="text-[11px] text-spruce-500">
                    Jump straight into unassigned ticket claiming
                  </div>
                </div>
              </button>

              {/* Action 3: Filter Critical / Urgent Blockers */}
              <button
                type="button"
                onClick={() => {
                  onFilterUrgent();
                  setIsQuickActionSheetOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">
                    Filter Urgent Incidents ({urgentCount})
                  </div>
                  <div className="text-[11px] text-spruce-500">
                    Focus on production blockers and high priority SLAs
                  </div>
                </div>
              </button>

              {/* Action 4: Invite Support Staff (Admin only) */}
              {user?.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenInviteSubtab();
                    setIsQuickActionSheetOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-spruce-950 dark:text-white">
                      Invite Support Engineer
                    </div>
                    <div className="text-[11px] text-spruce-500">
                      Generate secure invitation code for onboarding
                    </div>
                  </div>
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickActionSheetOpen(false)}
              className="w-full text-xs"
            >
              Close Actions
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
