'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import { API_BASE_URL } from '@lib/constants';

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

export interface RealtimeMessage {
  type:
    | 'TICKET_CREATED'
    | 'TICKET_UPDATED'
    | 'TICKET_DELETED'
    | 'COMMENT_ADDED'
    | 'CSAT_SUBMITTED'
    | 'NOTIFICATION'
    | 'HEARTBEAT';
  payload: any;
  timestamp: string;
}

export interface UseRealtimeEventsOptions {
  onTicketCreated?: (payload: any) => void;
  onTicketUpdated?: (payload: any) => void;
  onCommentAdded?: (payload: any) => void;
  onCsatSubmitted?: (payload: any) => void;
  onNotification?: (payload: any) => void;
}

/**
 * Hook for consuming the Server-Sent Events (SSE) live event stream.
 * Automatically invalidates active TanStack queries upon server-side mutations,
 * updates the real-time connectivity status, and provides fallback reconnection.
 */
export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = React.useState<RealtimeStatus>('disconnected');
  const [lastEvent, setLastEvent] = React.useState<RealtimeMessage | null>(null);

  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  React.useEffect(() => {
    if (!accessToken || typeof window === 'undefined') {
      setStatus('disconnected');
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isCleanedUp = false;
    let retryDelay = 1000;

    function connect() {
      if (isCleanedUp) return;
      setStatus('connecting');

      const url = `${API_BASE_URL}/realtime/stream?token=${encodeURIComponent(accessToken!)}`;
      eventSource = new EventSource(url, { withCredentials: true });

      eventSource.onopen = () => {
        if (isCleanedUp) return;
        setStatus('connected');
        retryDelay = 1000;
      };

      eventSource.onmessage = (event) => {
        if (isCleanedUp) return;
        try {
          const envelope: RealtimeMessage = JSON.parse(event.data);
          setLastEvent(envelope);

          if (envelope.type === 'HEARTBEAT') {
            return;
          }

          // Trigger reactive query cache invalidations
          switch (envelope.type) {
            case 'TICKET_CREATED':
              queryClient.invalidateQueries({ queryKey: ['tickets'] });
              optionsRef.current.onTicketCreated?.(envelope.payload);
              break;

            case 'TICKET_UPDATED':
              queryClient.invalidateQueries({ queryKey: ['tickets'] });
              if (envelope.payload?.ticketId) {
                queryClient.invalidateQueries({
                  queryKey: ['ticket', envelope.payload.ticketId],
                });
              }
              optionsRef.current.onTicketUpdated?.(envelope.payload);
              break;

            case 'COMMENT_ADDED':
              queryClient.invalidateQueries({ queryKey: ['tickets'] });
              if (envelope.payload?.ticketId) {
                queryClient.invalidateQueries({
                  queryKey: ['ticket', envelope.payload.ticketId],
                });
              }
              optionsRef.current.onCommentAdded?.(envelope.payload);
              break;

            case 'CSAT_SUBMITTED':
              queryClient.invalidateQueries({ queryKey: ['tickets'] });
              optionsRef.current.onCsatSubmitted?.(envelope.payload);
              break;

            case 'TICKET_DELETED':
              queryClient.invalidateQueries({ queryKey: ['tickets'] });
              break;

            case 'NOTIFICATION':
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              optionsRef.current.onNotification?.(envelope.payload);
              break;
          }
        } catch (err) {
          console.warn('Failed to parse SSE event payload:', err);
        }
      };

      eventSource.onerror = () => {
        if (isCleanedUp) return;
        setStatus('disconnected');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        // Exponential backoff capped at 10s
        reconnectTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 1.5, 10000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setStatus('disconnected');
    };
  }, [accessToken, queryClient]);

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    lastEvent,
  };
}
