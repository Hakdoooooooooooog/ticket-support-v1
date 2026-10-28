'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@ui/button';
import { ThemeToggle } from '@components/theme-toggle';
import { NotificationCenter } from '@components/notification-center';
import { AuthUser, getUserDisplayName, cn } from '@lib/helpers';

export interface AppHeaderProps {
  user: AuthUser | null;
  realtimeStatus?: 'connected' | 'connecting' | 'disconnected' | 'idle';
  onSignOut: () => void;
  onSelectTicket?: (ticketId: string) => void;
  titleBadge?: string;
  showAdminSwitch?: boolean;
  backLink?: { href: string; label: string };
}

export function AppHeader({
  user,
  realtimeStatus = 'connected',
  onSignOut,
  onSelectTicket,
  titleBadge = 'Customer Portal',
  showAdminSwitch = true,
  backLink,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-spruce-200 dark:border-spruce-800 bg-white/95 dark:bg-spruce-950/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {backLink && (
            <Link
              href={backLink.href}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-spruce-700 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white transition-colors py-1.5 px-2.5 rounded-lg border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800/80 hover:bg-spruce-100 dark:hover:bg-spruce-700 shadow-sm"
            >
              <span aria-hidden="true">&larr;</span>
              <span>{backLink.label}</span>
            </Link>
          )}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-sm shadow-sm">
              TS
            </div>
            <span className="font-extrabold text-lg tracking-tight text-spruce-900 dark:text-white">
              TicketSupport
            </span>
          </Link>
          {titleBadge && (
            <span className="hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-300 border border-spruce-200 dark:border-spruce-700/60">
              {titleBadge}
            </span>
          )}

          {/* Realtime Status Indicator */}
          <div className="flex items-center gap-1.5 pl-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  realtimeStatus === 'connected'
                    ? 'bg-spruce-400'
                    : realtimeStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  realtimeStatus === 'connected'
                    ? 'bg-spruce-500'
                    : realtimeStatus === 'connecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                )}
              />
            </span>
            <span
              suppressHydrationWarning
              className="hidden sm:inline text-[11px] font-medium text-spruce-500 dark:text-spruce-400"
            >
              {realtimeStatus === 'connected'
                ? 'Live Connected'
                : realtimeStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {onSelectTicket && <NotificationCenter onSelectTicket={onSelectTicket} />}
          {showAdminSwitch && (user?.role === 'ADMIN' || user?.role === 'AGENT') && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="text-xs">
                Switch to IT Admin Console
              </Button>
            </Link>
          )}
          {user && (
            <div
              suppressHydrationWarning
              className="hidden sm:flex items-center gap-2 text-xs text-spruce-700 dark:text-spruce-300 font-medium"
            >
              <span suppressHydrationWarning>{getUserDisplayName(user, 'User')}</span>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onSignOut} className="text-xs">
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}
