'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  notificationsControllerGetMyNotifications,
  notificationsControllerMarkRead,
  notificationsControllerMarkAllRead,
} from '@api';
import {
  AppNotification,
  NotificationListResponse,
  getStoredSession,
} from '@lib/helpers';
import { APP_VERSION } from '@lib/constants';
import { ContextualLoader } from '@ui/contextual-loader';
import { AppHeader } from '@components/navigation/app-header';
import { NotificationHeader } from '@components/notifications/notification-header';
import { NotificationFilters } from '@components/notifications/notification-filters';
import { NotificationItem } from '@components/notifications/notification-item';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { useRealtimeEvents } from '@hooks/use-realtime-events';

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status: realtimeStatus } = useRealtimeEvents();
  const { user, clearSession, ensureSessionVerified } = useAuthStore();
  const { highlightTicket } = useTicketsStore();

  const [activeFilter, setActiveFilter] = React.useState<'ALL' | 'UNREAD'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    const stored = getStoredSession();
    if (!stored?.accessToken && !user) {
      router.replace('/');
      return;
    }
    ensureSessionVerified().then((verified) => {
      if (!verified) router.replace('/');
    });
  }, [user, ensureSessionVerified, router]);

  const { data, isLoading, refetch, isFetching } = useQuery<NotificationListResponse>({
    queryKey: ['notifications', 'full-list'],
    queryFn: async () => {
      const res = (await notificationsControllerGetMyNotifications()) as any;
      return res;
    },
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await notificationsControllerMarkRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await notificationsControllerMarkAllRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const allNotifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const filteredNotifications = React.useMemo(() => {
    return allNotifications.filter((n) => {
      if (activeFilter === 'UNREAD' && n.read) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchMsg = n.message.toLowerCase().includes(q);
        const matchTicket = n.ticketId.toLowerCase().includes(q);
        if (!matchTitle && !matchMsg && !matchTicket) return false;
      }
      return true;
    });
  }, [allNotifications, activeFilter, searchQuery]);

  const handleOpenTicket = (notif: AppNotification) => {
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }
    highlightTicket(notif.ticketId);
    if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
      router.push(`/admin?ticketId=${notif.ticketId}`);
    } else {
      router.push(`/portal?ticketId=${notif.ticketId}`);
    }
  };

  const handleSignOut = () => {
    clearSession();
    router.replace('/');
  };

  const backUrl = user?.role === 'ADMIN' || user?.role === 'AGENT' ? '/admin' : '/portal';
  const backLabel = user?.role === 'ADMIN' || user?.role === 'AGENT' ? 'Back to Admin Console' : 'Back to Portal';

  return (
    <div className="min-h-screen flex flex-col bg-spruce-50 dark:bg-spruce-950 text-spruce-950 dark:text-spruce-50">
      <AppHeader
        user={user}
        realtimeStatus={realtimeStatus}
        onSignOut={handleSignOut}
        titleBadge=""
        showAdminSwitch={false}
        backLink={{ href: backUrl, label: backLabel }}
      />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <NotificationHeader
            unreadCount={unreadCount}
            onMarkAllRead={() => markAllReadMutation.mutate()}
            isMarkingAllRead={markAllReadMutation.isPending}
            onRefresh={() => refetch()}
            isRefreshing={isFetching}
          />

          <NotificationFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            totalCount={allNotifications.length}
            unreadCount={unreadCount}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {isLoading ? (
            <div className="space-y-3">
              <ContextualLoader context="portal-auth" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-spruce-200 bg-white dark:border-spruce-800 dark:bg-spruce-900/40 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-spruce-100 text-spruce-600 dark:bg-spruce-800 dark:text-spruce-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-spruce-900 dark:text-white">
                {activeFilter === 'UNREAD' ? 'No unread notifications' : 'No notifications found'}
              </h3>
              <p className="text-xs text-spruce-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try searching with a different keyword or ticket reference.'
                  : 'You are all caught up! New ticket assignment and response alerts will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  onOpenTicket={handleOpenTicket}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-spruce-200 dark:border-spruce-800 py-6 px-4 sm:px-6 lg:px-8 text-xs text-spruce-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>TicketSupport Helpdesk Platform &bull; Realtime Notifications</p>
          <p className="font-mono text-[11px] text-spruce-500">Version {APP_VERSION}</p>
        </div>
      </footer>
    </div>
  );
}
