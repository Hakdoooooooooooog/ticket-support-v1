'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client';
import {
  AppNotification,
  NotificationListResponse,
  formatNotificationTime,
  getNotificationBadge,
  getStoredSession,
  cn,
} from '@lib/helpers';
import { APP_VERSION } from '@lib/constants';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Input } from '@ui/input';
import { ContextualLoader } from '@ui/contextual-loader';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { useRealtimeEvents } from '@hooks/use-realtime-events';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status: realtimeStatus } = useRealtimeEvents();
  const {
    user,
    isSessionVerified,
    isVerifyingSession,
    ensureSessionVerified,
    clearSession,
  } = useAuthStore();
  const { clearTickets } = useTicketsStore();

  const [activeFilter, setActiveFilter] = React.useState<'ALL' | 'UNREAD'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Authentication check
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

  // Notifications query
  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<NotificationListResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationListResponse>('/notifications');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch('/notifications/mark-all-read');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace('/');
  };

  const handleOpenTicket = (notif: AppNotification) => {
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }
    const targetRoute =
      user?.role === 'CUSTOMER'
        ? `/portal?ticketId=${encodeURIComponent(notif.ticketId)}`
        : `/admin?ticketId=${encodeURIComponent(notif.ticketId)}`;
    router.push(targetRoute);
  };

  if (!user && isVerifyingSession) {
    return <ContextualLoader context="portal-auth" />;
  }

  const allNotifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const filteredNotifications = allNotifications.filter((notif) => {
    if (activeFilter === 'UNREAD' && notif.read) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = notif.title.toLowerCase().includes(q);
      const matchMsg = notif.message.toLowerCase().includes(q);
      const matchTicket = notif.ticketId.toLowerCase().includes(q);
      return matchTitle || matchMsg || matchTicket;
    }
    return true;
  });

  const backUrl = user?.role === 'CUSTOMER' ? '/portal' : '/admin';
  const backLabel =
    user?.role === 'CUSTOMER'
      ? 'Back to Customer Portal'
      : 'Back to IT Admin Console';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={backUrl}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700"
            >
              <span aria-hidden="true">&larr;</span>
              <span>{backLabel}</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
              <span className="font-extrabold text-sm tracking-tight text-white">
                TicketSupport
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
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
              <span className="hidden md:inline text-[11px] font-medium text-slate-400">
                {realtimeStatus === 'connected'
                  ? 'Live Connected'
                  : realtimeStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>

            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
                <span className="font-medium">{user.fullName}</span>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-slate-400 hover:text-white text-xs"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Notification Center Content */}
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header & Mark-All-Read Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Notification Center
                </h1>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Review automated alerts, follow-up requests, customer amendments, and resolution notes.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="text-xs border-slate-700 hover:bg-slate-800 text-slate-200"
                >
                  Mark all as read
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-xs text-slate-400 hover:text-white"
              >
                {isFetching ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          {/* Filtering and Search Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800 w-fit">
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({allNotifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('UNREAD')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeFilter === 'UNREAD'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="w-full sm:w-72">
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-slate-900 border-slate-800 text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Notifications Feed */}
          {isLoading ? (
            <div className="space-y-3">
              <ContextualLoader context="portal-auth" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">
                {activeFilter === 'UNREAD'
                  ? 'No unread notifications'
                  : 'No notifications found'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try clearing your search query to see other notifications.'
                  : activeFilter === 'UNREAD'
                  ? 'You have caught up with all incoming ticket and status alerts.'
                  : 'You do not have any notification records yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => {
                const badgeMeta = getNotificationBadge(notif.type);
                return (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      !notif.read
                        ? 'bg-slate-900/90 border-blue-500/40 shadow-sm shadow-blue-500/5'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div
                        className={`mt-0.5 flex h-6 px-2 shrink-0 items-center justify-center rounded border text-[9px] uppercase tracking-wider font-extrabold ${badgeMeta.badgeClass}`}
                      >
                        {badgeMeta.label}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm ${
                              !notif.read
                                ? 'font-bold text-white'
                                : 'font-medium text-slate-300'
                            }`}
                          >
                            {notif.title}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatNotificationTime(notif.createdAt)}
                          </span>
                          {!notif.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" title="Unread" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {notif.message}
                        </p>
                        <div className="pt-0.5">
                          <span className="font-mono text-[10px] text-slate-500">
                            Ticket #{notif.ticketId.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      {!notif.read && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => markReadMutation.mutate(notif.id)}
                          className="text-xs text-slate-400 hover:text-white h-8"
                        >
                          Mark as read
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenTicket(notif)}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
                      >
                        <span>Open Ticket</span>
                        <span aria-hidden="true" className="ml-1">&rarr;</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>TicketSupport Helpdesk Platform &bull; Realtime Notifications</p>
          <p className="font-mono text-[11px] text-slate-500">
            Version {APP_VERSION}
          </p>
        </div>
      </footer>
    </div>
  );
}
