'use client';

import * as React from 'react';
import { Button } from '@ui/button';

export interface NotificationHeaderProps {
  unreadCount: number;
  onMarkAllRead: () => void;
  isMarkingAllRead: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function NotificationHeader({
  unreadCount,
  onMarkAllRead,
  isMarkingAllRead,
  onRefresh,
  isRefreshing,
}: NotificationHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-spruce-200 dark:border-spruce-800 pb-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-spruce-950 dark:text-white">
            Notification Center
          </h1>
          {unreadCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-spruce-100 text-spruce-800 border border-spruce-300 dark:bg-spruce-800 dark:text-spruce-300 dark:border-spruce-700">
              {unreadCount} unread
            </span>
          )}
        </div>
        <p className="text-xs text-spruce-600 dark:text-spruce-400">
          Review automated alerts, follow-up requests, customer amendments, and resolution notes.
        </p>
      </div>

      <div className="flex items-center gap-2.5 self-start sm:self-auto">
        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onMarkAllRead}
            disabled={isMarkingAllRead}
            className="text-xs border-spruce-300 hover:bg-spruce-100 text-spruce-800 dark:border-spruce-700 dark:hover:bg-spruce-800 dark:text-spruce-200"
          >
            Mark all as read
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
