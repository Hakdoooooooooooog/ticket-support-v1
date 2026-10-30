"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  notificationsControllerGetMyNotifications,
  notificationsControllerMarkRead,
  notificationsControllerMarkAllRead,
} from "../api/endpoints/notifications/notifications";
import {
  AppNotification,
  NotificationListResponse,
  formatNotificationTime,
  getNotificationBadge,
} from "@lib/helpers";
import { Button } from "@ui/button";
import { useState, useRef, useEffect } from "react";

interface NotificationCenterProps {
  onSelectTicket?: (ticketId: string) => void;
  className?: string;
}

export function NotificationCenter({
  onSelectTicket,
  className = "",
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<NotificationListResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = (await notificationsControllerGetMyNotifications()) as any;
      return res;
    },
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await notificationsControllerMarkRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await notificationsControllerMarkAllRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Handle clicking outside to dismiss popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];
  const visibleNotifications = notifications.slice(0, 5);

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
        className="relative p-2 rounded-lg text-spruce-600 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400"
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
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-spruce-200 dark:border-spruce-700/80 bg-white/95 dark:bg-spruce-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between p-3.5 border-b border-spruce-200 dark:border-spruce-800 bg-spruce-50/80 dark:bg-spruce-950/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-spruce-950 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-spruce-100 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-300 border border-spruce-300 dark:border-spruce-700">
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
                className="h-7 px-2 text-[11px] text-spruce-600 dark:text-spruce-400 hover:text-spruce-950 dark:hover:text-white"
              >
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-spruce-100 dark:divide-spruce-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-spruce-600 dark:text-spruce-300">
                  All Caught Up
                </div>
                <div className="text-xs text-spruce-500 dark:text-spruce-400">
                  No pending notifications in your feed.
                </div>
                <div className="pt-2">
                  <Link
                    href="/notifications"
                    onClick={() => setIsOpen(false)}
                    className="text-xs text-spruce-600 dark:text-spruce-300 hover:underline"
                  >
                    View notifications history &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              visibleNotifications.map((notif) => {
                const badgeMeta = getNotificationBadge(notif.type);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-spruce-50 dark:hover:bg-spruce-800/60 ${
                      !notif.read
                        ? "bg-spruce-100/40 dark:bg-spruce-800/25"
                        : ""
                    }`}
                  >
                    <div
                      className={`flex h-6 px-2 shrink-0 items-center justify-center rounded border text-[9px] uppercase tracking-wider font-extrabold ${badgeMeta.badgeClass}`}
                    >
                      {badgeMeta.label}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs truncate ${
                            !notif.read
                              ? "font-bold text-spruce-950 dark:text-white"
                              : "font-medium text-spruce-700 dark:text-spruce-300"
                          }`}
                        >
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-spruce-400 shrink-0">
                          {formatNotificationTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-spruce-600 dark:text-spruce-400 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-spruce-400 shrink-0 mt-1.5 shadow" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer linking to full notifications center route */}
          <div className="p-2.5 border-t border-spruce-200 dark:border-spruce-800 bg-spruce-50/80 dark:bg-spruce-950/80 text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 text-xs font-semibold text-spruce-700 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white hover:bg-spruce-100 dark:hover:bg-spruce-800/60 rounded-md transition-colors"
            >
              <span>View all notifications</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-spruce-200 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-300 border border-spruce-300 dark:border-spruce-700">
                {notifications.length}
              </span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
