'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TicketForm } from '@components/forms/ticket-form';
import { TicketList } from '@components/ticket-list';
import { AppHeader } from '@components/navigation/app-header';
import { ContextualLoader } from '@ui/contextual-loader';
import { getStoredSession } from '@lib/helpers';
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
    <div className="min-h-screen flex flex-col bg-spruce-50 dark:bg-spruce-950 text-spruce-950 dark:text-spruce-50">
      <AppHeader
        user={user}
        realtimeStatus={realtimeStatus}
        onSignOut={handleSignOut}
        onSelectTicket={handleSelectTicket}
        titleBadge="Customer Portal"
        showAdminSwitch={user?.role === 'ADMIN' || user?.role === 'AGENT'}
      />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-spruce-950 dark:text-white">
              Customer Support Portal
            </h1>
            <p className="text-sm text-spruce-600 dark:text-spruce-300">
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

      <footer className="border-t border-spruce-200 dark:border-spruce-800 py-6 px-4 sm:px-6 lg:px-8 text-xs text-spruce-600 dark:text-spruce-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>TicketSupport Helpdesk Platform</p>
          <p className="font-mono text-[11px] text-spruce-500/80 dark:text-spruce-400/70">
            Version {APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}
