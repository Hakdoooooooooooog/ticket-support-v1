'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client';
import { AppNotification, NotificationListResponse } from '@lib/helpers';
import { Button } from '@ui/button';

interface NotificationCenterProps {
  onSelectTicket?: (ticketId: string) => void;
  className?: string;
}

function formatNotificationTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
}

function getNotificationIcon(type: AppNotification['type']): {
  icon: string;
  bg: string;
  text: string;
} {
  switch (type) {
    case 'TICKET_FOLLOW_UP_REQUESTED':
      return {
        icon: '⚠️',
        bg: 'bg-amber-500/10 border-amber-500/20',
        text: 'text-amber-500',
      };
    case 'TICKET_CUSTOMER_AMENDED':
      return {
        icon: '💬',
        bg: 'bg-blue-500/10 border-blue-500/20',
        text: 'text-blue-500',
      };
    case 'TICKET_NOTE_POSTED':
      return {
        icon: '📝',
        bg: 'bg-purple-500/10 border-purple-500/20',
        text: 'text-purple-500',
      };
    case 'TICKET_ASSIGNED':
      return {
        icon: '👤',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        text: 'text-emerald-500',
      };
    case 'TICKET_STATUS_CHANGED':
    default:
      return {
        icon: '🔄',
        bg: 'bg-cyan-500/10 border-cyan-500/20',
        text: 'text-cyan-500',
      };
  }
}

export function NotificationCenter({ onSelectTicket, className = '' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationListResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationListResponse>('/notifications');
      return res.data;
    },
    refetchInterval: 10000,
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

  // Handle clicking outside to dismiss popover
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }
    if (onSelectTicket) {
      onSelectTicket(notif.ticketId);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        aria-label="View notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="h-7 px-2 text-[11px] text-slate-400 hover:text-white"
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <div className="text-3xl">🎉</div>
                <div className="text-xs font-medium text-slate-300">All caught up!</div>
                <div className="text-[11px] text-slate-500">
                  No notifications to display right now.
                </div>
              </div>
            ) : (
              notifications.map((notif) => {
                const iconMeta = getNotificationIcon(notif.type);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-slate-800/60 ${
                      !notif.read ? 'bg-blue-500/5' : ''
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${iconMeta.bg} ${iconMeta.text}`}
                    >
                      {iconMeta.icon}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs truncate ${
                            !notif.read
                              ? 'font-bold text-white'
                              : 'font-medium text-slate-300'
                          }`}
                        >
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {formatNotificationTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5 shadow" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
