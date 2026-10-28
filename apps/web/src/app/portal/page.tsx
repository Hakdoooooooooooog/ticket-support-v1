'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TicketForm } from '@components/forms/ticket-form';
import { TicketList } from '@components/ticket-list';
import { NotificationCenter } from '@components/notification-center';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { ContextualLoader } from '@ui/contextual-loader';
import { getStoredSession, cn } from '@lib/helpers';
import { APP_VERSION } from '@lib/constants';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { useRealtimeEvents } from '@hooks/use-realtime-events';

export default function CustomerPortalPage() {
  const router = useRouter();
  const { status: realtimeStatus } = useRealtimeEvents();
  const {
    user,
    isSessionVerified,
    isVerifyingSession,
    ensureSessionVerified,
    clearSession,
  } = useAuthStore();
  const { clearTickets, highlightTicket } = useTicketsStore();

  const handleSelectTicket = React.useCallback((ticketId: string) => {
    highlightTicket(ticketId);
  }, [highlightTicket]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetTicketId = params.get('ticketId');
    if (targetTicketId) {
      const timer = setTimeout(() => {
        handleSelectTicket(targetTicketId);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [handleSelectTicket]);

  React.useEffect(() => {
    if (isSessionVerified && user) {
      return;
    }

    const stored = getStoredSession();
    if (!stored?.accessToken && !user) {
      router.replace('/');
      return;
    }

    ensureSessionVerified().then((verified) => {
      if (!verified) {
        router.replace('/');
      }
    });
  }, [isSessionVerified, user, ensureSessionVerified, router]);

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace('/');
  };

  if (!user && isVerifyingSession) {
    return <ContextualLoader context="portal-auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
              TicketSupport
            </span>
            <span className="text-xs font-medium text-slate-500 border-l border-slate-300 dark:border-slate-800 pl-2.5">
              Customer Portal
            </span>
            <div className="flex items-center gap-1.5 ml-1 text-xs text-slate-500">
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={cn(
                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-400'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex rounded-full h-2 w-2',
                    realtimeStatus === 'connected'
                      ? 'bg-emerald-500'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500',
                  )}
                />
              </span>
              <span className="hidden sm:inline text-[11px] font-medium text-slate-400">
                {realtimeStatus === 'connected'
                  ? 'Live Connected'
                  : realtimeStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter onSelectTicket={handleSelectTicket} />
            {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  Switch to IT Admin Console
                </Button>
              </Link>
            )}
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{user.fullName}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Customer Support Portal
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Submit new helpdesk requests and track real-time status updates from our IT engineering team.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <TicketForm creatorId={user?.id} />
            </div>
            <div className="lg:col-span-7">
              <TicketList />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>TicketSupport Helpdesk Platform</p>
          <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            Version {APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}
