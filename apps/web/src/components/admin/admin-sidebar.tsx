'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { APP_VERSION } from '@lib/constants';
import { AuthUser, getUserDisplayName, getUserInitial } from '@lib/helpers';
import type { AdminSection } from '@store/admin.store';

interface AdminSidebarProps {
  user: AuthUser | null;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  unassignedCount: number;
  totalTicketsCount: number;
  myAssignedCount: number;
  isFetching: boolean;
  realtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  onRefresh: () => void;
  onSignOut: () => void;
}

export function AdminSidebar({
  user,
  activeSection,
  onSelectSection,
  unassignedCount,
  totalTicketsCount,
  myAssignedCount,
  isFetching,
  realtimeStatus,
  onRefresh,
  onSignOut,
}: AdminSidebarProps) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-950 z-20 select-none shadow-sm">
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-spruce-200 dark:border-spruce-800 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-xs shadow-sm shrink-0">
            TS
          </div>
          <span className="font-extrabold text-base tracking-tight text-spruce-900 dark:text-white truncate">
            TicketSupport
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-spruce-100 text-spruce-800 dark:bg-spruce-800/80 dark:text-spruce-300 border border-spruce-300/60 dark:border-spruce-700 whitespace-nowrap shrink-0">
          IT Console
        </span>
      </div>

      {/* Staff Profile Card */}
      {user && (
        <div className="p-4 border-b border-spruce-200 dark:border-spruce-800 bg-spruce-50/70 dark:bg-spruce-900/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-300 font-bold flex items-center justify-center shrink-0 border border-spruce-300 dark:border-spruce-700 text-xs">
                {getUserInitial(user)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs truncate text-spruce-900 dark:text-white">
                  {getUserDisplayName(user)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                    className="text-[10px] py-0 px-1.5"
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Routes */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelectSection('DASHBOARD')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSection === 'DASHBOARD'
              ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
              : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
          }`}
        >
          <span>Dashboard Overview</span>
          {unassignedCount > 0 && (
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                activeSection === 'DASHBOARD'
                  ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                  : 'bg-amber-500/20 text-amber-500'
              }`}
            >
              {unassignedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('ALL_TICKETS')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSection === 'ALL_TICKETS'
              ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
              : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
          }`}
        >
          <span>All Tickets</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeSection === 'ALL_TICKETS'
                ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                : 'bg-spruce-200 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300'
            }`}
          >
            {totalTicketsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('ASSIGNED_TICKETS')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSection === 'ASSIGNED_TICKETS'
              ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
              : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
          }`}
        >
          <span>Assigned Tickets</span>
          <span
            className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeSection === 'ASSIGNED_TICKETS'
                ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                : 'bg-spruce-100 text-spruce-800 dark:bg-spruce-700 dark:text-spruce-200'
            }`}
          >
            {myAssignedCount}
          </span>
        </button>

        {/* Canned Responses Tab (Available to IT Staff & Admins) */}
        <button
          type="button"
          onClick={() => onSelectSection('CANNED_RESPONSES')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSection === 'CANNED_RESPONSES'
              ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
              : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
          }`}
        >
          <span>Canned Responses</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-spruce-200/60 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
            Templates
          </span>
        </button>

        {/* Reports & CSAT Studio */}
        <button
          type="button"
          onClick={() => onSelectSection('REPORTS')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSection === 'REPORTS'
              ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
              : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
          }`}
        >
          <span>Reports &amp; CSAT</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-spruce-200/60 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
            Export
          </span>
        </button>

        {/* Admin Exclusive: IT Support Team & Staff Invites */}
        {user?.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => onSelectSection('TEAM_MANAGEMENT')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'TEAM_MANAGEMENT'
                ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
                : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
            }`}
          >
            <span>Team &amp; Invites</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider ${
                activeSection === 'TEAM_MANAGEMENT'
                  ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                  : 'bg-emerald-500/20 text-emerald-500'
              }`}
            >
              Admin
            </span>
          </button>
        )}

        <div className="pt-3 border-t border-spruce-200 dark:border-spruce-800">
          <Link
            href="/portal"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900 transition-colors"
          >
            <span>Customer Portal</span>
            <span className="text-[10px] font-bold text-spruce-400 uppercase tracking-wider">
              Portal
            </span>
          </Link>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 pb-8 border-t border-spruce-200 dark:border-spruce-800 space-y-3 bg-spruce-50/50 dark:bg-spruce-950/50">
        <div className="flex items-center justify-between text-xs text-spruce-500">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isFetching
                    ? 'bg-spruce-400'
                    : realtimeStatus === 'connected'
                    ? 'bg-emerald-400'
                    : realtimeStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isFetching
                    ? 'bg-spruce-500'
                    : realtimeStatus === 'connected'
                    ? 'bg-emerald-500'
                    : realtimeStatus === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
            </span>
            <span className="text-[11px] font-medium truncate">
              {isFetching
                ? 'Syncing...'
                : realtimeStatus === 'connected'
                ? 'Live Connected'
                : realtimeStatus === 'connecting'
                ? 'Connecting...'
                : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-6 px-1.5 text-[10px]"
            >
              Refresh
            </Button>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 text-spruce-600 dark:text-spruce-300">
              {APP_VERSION}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSignOut}
          className="w-full justify-center gap-2 h-9 text-xs font-semibold border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900 text-spruce-800 dark:text-spruce-200 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-500 dark:hover:text-rose-300 transition-colors shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
