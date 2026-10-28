'use client';

import * as React from 'react';
import { Button } from '@ui/button';
import { AppNotification, getNotificationBadge, formatNotificationTime } from '@lib/helpers';

export interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead?: (id: string) => void;
  onOpenTicket: (notification: AppNotification) => void;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onOpenTicket,
}: NotificationItemProps) {
  const badgeMeta = getNotificationBadge(notification.type);

  return (
    <div
      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        !notification.read
          ? 'bg-white border-spruce-300 shadow-sm dark:bg-spruce-900/90 dark:border-spruce-600'
          : 'bg-white/60 border-spruce-200 hover:bg-white dark:bg-spruce-900/40 dark:border-spruce-800/80 dark:hover:bg-spruce-900/60'
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
                !notification.read
                  ? 'font-bold text-spruce-950 dark:text-white'
                  : 'font-medium text-spruce-700 dark:text-spruce-300'
              }`}
            >
              {notification.title}
            </span>
            <span className="text-[11px] text-spruce-500 dark:text-spruce-400">
              {formatNotificationTime(notification.createdAt)}
            </span>
            {!notification.read && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-spruce-600 dark:bg-spruce-300 shrink-0"
                title="Unread"
              />
            )}
          </div>
          <p className="text-xs text-spruce-600 dark:text-spruce-400 leading-relaxed">
            {notification.message}
          </p>
          <div className="pt-0.5">
            <span className="font-mono text-[10px] text-spruce-500 dark:text-spruce-400">
              Ticket #{notification.ticketId.slice(0, 8)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-spruce-200 dark:border-spruce-800">
        {!notification.read && onMarkRead && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMarkRead(notification.id)}
            className="text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white h-8"
          >
            Mark as read
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => onOpenTicket(notification)}
          className="text-xs h-8 bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950 font-semibold"
        >
          <span>Open Ticket</span>
          <span aria-hidden="true" className="ml-1">
            &rarr;
          </span>
        </Button>
      </div>
    </div>
  );
}
