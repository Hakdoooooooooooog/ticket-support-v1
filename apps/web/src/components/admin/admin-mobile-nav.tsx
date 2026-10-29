'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { ThemeToggle } from '@components/theme-toggle';
import { NotificationCenter } from '@components/notification-center';
import { AuthUser, getUserDisplayName } from '@lib/helpers';
import type { AdminSection } from '@store/admin.store';

interface AdminMobileNavProps {
  user: AuthUser | null;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  unassignedCount: number;
  totalTicketsCount: number;
  myAssignedCount: number;
  onSelectTicket: (ticketId: string) => void;
  onSignOut: () => void;
}

export function AdminMobileNav({
  user,
  activeSection,
  onSelectSection,
  isOpen,
  onToggleOpen,
  onClose,
  unassignedCount,
  totalTicketsCount,
  myAssignedCount,
  onSelectTicket,
  onSignOut,
}: AdminMobileNavProps) {
  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 border-b border-spruce-200 dark:border-spruce-800 bg-white/95 dark:bg-spruce-950/95 backdrop-blur-md px-3 sm:px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            onClick={onToggleOpen}
            className="p-2 rounded-lg text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900 border border-spruce-200 dark:border-spruce-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 transition-colors shrink-0"
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="w-7 h-7 rounded-lg bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-xs shadow-sm shrink-0">
            TS
          </div>
          <span className="font-extrabold text-base tracking-tight text-spruce-900 dark:text-white">
            TicketSupport
          </span>
          <span className="hidden xs:inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-spruce-100 text-spruce-800 dark:bg-spruce-800/80 dark:text-spruce-300 border border-spruce-300/60 dark:border-spruce-700 whitespace-nowrap">
            IT Console
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationCenter onSelectTicket={onSelectTicket} />
          <Button variant="ghost" size="sm" onClick={onSignOut} className="h-8 text-xs px-2.5">
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={onClose}
          className="lg:hidden fixed inset-0 z-40 bg-spruce-950/70 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[80vw] h-full bg-white dark:bg-spruce-950 p-4 flex flex-col justify-between shadow-2xl"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-spruce-200 dark:border-spruce-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-[11px] shadow-sm shrink-0">
                    TS
                  </div>
                  <span className="font-extrabold text-base tracking-tight">TicketSupport</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  className="p-1 rounded-md text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {user && (
                <div className="p-2.5 rounded-lg bg-spruce-100/70 dark:bg-spruce-900 text-xs space-y-1">
                  <p className="font-semibold">{getUserDisplayName(user)}</p>
                  {user.email && <p className="text-spruce-500">{user.email}</p>}
                  <Badge variant="secondary">{user.role}</Badge>
                </div>
              )}

              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('DASHBOARD');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'DASHBOARD'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Dashboard Overview</span>
                  {unassignedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-bold">
                      {unassignedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('ALL_TICKETS');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'ALL_TICKETS'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>All Tickets</span>
                  <span className="text-[10px] font-bold text-spruce-500">
                    {totalTicketsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('ASSIGNED_TICKETS');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'ASSIGNED_TICKETS'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Assigned Tickets</span>
                  <span className="text-[10px] font-bold text-spruce-500">
                    {myAssignedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('CANNED_RESPONSES');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'CANNED_RESPONSES'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Canned Responses</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-spruce-200/60 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
                    Templates
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('KNOWLEDGE_BASE');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'KNOWLEDGE_BASE'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Knowledge Base</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-spruce-200/60 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
                    Articles
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSection('REPORTS');
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'REPORTS'
                      ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Reports &amp; CSAT</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-spruce-200/60 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
                    Export
                  </span>
                </button>

                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSection('TEAM_MANAGEMENT');
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                      activeSection === 'TEAM_MANAGEMENT'
                        ? 'bg-spruce-100 text-spruce-950 font-bold border-l-4 border-l-spruce-700 dark:bg-spruce-300 dark:text-spruce-950 dark:border-l-0'
                        : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                    }`}
                  >
                    <span>Team &amp; Invites</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-500">
                      Admin
                    </span>
                  </button>
                )}

                <div className="pt-2 border-t border-spruce-200 dark:border-spruce-800">
                  <Link
                    href="/portal"
                    onClick={onClose}
                    className="w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900"
                  >
                    <span>Customer Portal</span>
                    <span className="text-[10px] font-bold text-spruce-400 uppercase tracking-wider">
                      Portal
                    </span>
                  </Link>
                </div>
              </nav>
            </div>

            <div className="pt-4 border-t border-spruce-200 dark:border-spruce-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="w-full justify-center text-xs font-semibold"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
