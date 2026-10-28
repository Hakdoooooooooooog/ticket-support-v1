'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Ticket } from '@components/ticket-list';
import {
  fetchAndDecryptTicketAttachment,
  fetchAndDecryptCommentAttachment,
  type DecryptedAttachmentResult,
} from '@lib/helpers';

export interface TicketsState {
  tickets: Ticket[];
  hasLoadedTickets: boolean;
  lastUpdatedAt: string | null;

  // Accordion & Portal UI state managed in Zustand
  expandedTicketIds: Record<string, boolean>;
  expandedCommentHistories: Record<string, boolean>;
  viewedTicketIds: Record<string, boolean>;
  highlightedTicketId: string | null;
  hasInitializedExpansion: boolean;
  portalSearchQuery: string;

  // On-demand attachment cache (keyed by `ticket:${ticketId}` or `comment:${commentId}`)
  decryptedAttachments: Record<string, DecryptedAttachmentResult>;
  loadingAttachmentKeys: Record<string, boolean>;
  hiddenAttachmentKeys: Record<string, boolean>;
  lightboxImage: DecryptedAttachmentResult | null;

  setTickets: (tickets: Ticket[]) => void;
  upsertTicket: (ticket: Ticket) => void;
  removeTicket: (id: string) => void;
  clearTickets: () => void;

  setPortalSearchQuery: (query: string) => void;
  initializeDefaultExpansion: (tickets: Ticket[]) => void;
  toggleTicketExpanded: (ticketId: string) => void;
  setTicketExpanded: (ticketId: string, expanded: boolean) => void;
  setAllTicketsExpanded: (tickets: Ticket[], expanded: boolean) => void;
  markTicketViewed: (ticketId: string) => void;
  markTicketUnviewed: (ticketId: string) => void;
  markAllTicketsViewed: (tickets: Ticket[]) => void;
  setHighlightedTicketId: (ticketId: string | null) => void;
  highlightTicket: (ticketId: string) => void;
  toggleCommentHistory: (ticketId: string) => void;

  loadTicketAttachment: (ticketId: string) => Promise<void>;
  loadCommentAttachment: (ticketId: string, commentId: string) => Promise<void>;
  ensureTicketAttachmentsLoaded: (ticket: Ticket) => Promise<void>;
  toggleAttachmentVisibility: (key: string) => void;
  setLightboxImage: (image: DecryptedAttachmentResult | null) => void;
}

// Self-healing: Proactively purge legacy verbose keys and any stored ticket entities (customer PII)
if (typeof window !== 'undefined') {
  try {
    window.sessionStorage.removeItem('ts_zustand_tickets_store');

    const rawTickets = window.sessionStorage.getItem('ts_tickets');
    if (rawTickets && rawTickets.includes('"tickets"')) {
      const parsed = JSON.parse(rawTickets);
      if (parsed?.state?.tickets) {
        delete parsed.state.tickets;
        window.sessionStorage.setItem('ts_tickets', JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

export const useTicketsStore = create<TicketsState>()(
  persist(
    (set, get) => ({
      tickets: [],
      hasLoadedTickets: false,
      lastUpdatedAt: null,

      expandedTicketIds: {},
      expandedCommentHistories: {},
      viewedTicketIds: {},
      highlightedTicketId: null,
      hasInitializedExpansion: false,
      portalSearchQuery: '',

      decryptedAttachments: {},
      loadingAttachmentKeys: {},
      hiddenAttachmentKeys: {},
      lightboxImage: null,

      setTickets: (tickets: Ticket[]) => {
        set({
          tickets,
          hasLoadedTickets: true,
          lastUpdatedAt: new Date().toISOString(),
        });
      },

      upsertTicket: (ticket: Ticket) => {
        const current = get().tickets;
        const exists = current.some((t) => t.id === ticket.id);
        const next = exists
          ? current.map((t) => (t.id === ticket.id ? ticket : t))
          : [ticket, ...current];
        set({
          tickets: next,
          hasLoadedTickets: true,
          lastUpdatedAt: new Date().toISOString(),
        });
      },

      removeTicket: (id: string) => {
        set({
          tickets: get().tickets.filter((t) => t.id !== id),
          lastUpdatedAt: new Date().toISOString(),
        });
      },

      clearTickets: () => {
        set({
          tickets: [],
          hasLoadedTickets: false,
          lastUpdatedAt: null,
          expandedTicketIds: {},
          expandedCommentHistories: {},
          viewedTicketIds: {},
          highlightedTicketId: null,
          hasInitializedExpansion: false,
          portalSearchQuery: '',
          decryptedAttachments: {},
          loadingAttachmentKeys: {},
          hiddenAttachmentKeys: {},
        });
      },

      setPortalSearchQuery: (portalSearchQuery: string) => {
        set({ portalSearchQuery });
      },

      initializeDefaultExpansion: (tickets: Ticket[]) => {
        if (get().hasInitializedExpansion || tickets.length === 0) {
          return;
        }
        const initial: Record<string, boolean> = {};
        const viewed = { ...get().viewedTicketIds };
        tickets.forEach((ticket, idx) => {
          if (idx === 0 || ticket.status === 'NEEDS_INFO') {
            initial[ticket.id] = true;
            viewed[ticket.id] = true;
          }
        });
        set({
          expandedTicketIds: initial,
          viewedTicketIds: viewed,
          hasInitializedExpansion: true,
        });
      },

      toggleTicketExpanded: (ticketId: string) => {
        const current = get().expandedTicketIds;
        const willBeExpanded = !current[ticketId];
        set({
          expandedTicketIds: {
            ...current,
            [ticketId]: willBeExpanded,
          },
          ...(willBeExpanded
            ? {
                viewedTicketIds: {
                  ...get().viewedTicketIds,
                  [ticketId]: true,
                },
              }
            : {}),
        });
      },

      setTicketExpanded: (ticketId: string, expanded: boolean) => {
        set({
          expandedTicketIds: {
            ...get().expandedTicketIds,
            [ticketId]: expanded,
          },
          ...(expanded
            ? {
                viewedTicketIds: {
                  ...get().viewedTicketIds,
                  [ticketId]: true,
                },
              }
            : {}),
        });
      },

      setAllTicketsExpanded: (tickets: Ticket[], expanded: boolean) => {
        if (!expanded) {
          set({ expandedTicketIds: {} });
          return;
        }
        const nextExp: Record<string, boolean> = {};
        const nextViewed = { ...get().viewedTicketIds };
        tickets.forEach((t) => {
          nextExp[t.id] = true;
          nextViewed[t.id] = true;
        });
        set({
          expandedTicketIds: nextExp,
          viewedTicketIds: nextViewed,
        });
      },

      markTicketViewed: (ticketId: string) => {
        set({
          viewedTicketIds: {
            ...get().viewedTicketIds,
            [ticketId]: true,
          },
        });
      },

      markTicketUnviewed: (ticketId: string) => {
        const next = { ...get().viewedTicketIds };
        delete next[ticketId];
        set({ viewedTicketIds: next });
      },

      markAllTicketsViewed: (tickets: Ticket[]) => {
        const next = { ...get().viewedTicketIds };
        tickets.forEach((t) => {
          next[t.id] = true;
        });
        set({ viewedTicketIds: next });
      },

      toggleCommentHistory: (ticketId: string) => {
        const current = get().expandedCommentHistories;
        set({
          expandedCommentHistories: {
            ...current,
            [ticketId]: !current[ticketId],
          },
        });
      },

      setHighlightedTicketId: (ticketId: string | null) => {
        set({ highlightedTicketId: ticketId });
      },

      highlightTicket: (ticketId: string) => {
        const current = get().expandedTicketIds;
        set({
          expandedTicketIds: {
            ...current,
            [ticketId]: true,
          },
          viewedTicketIds: {
            ...get().viewedTicketIds,
            [ticketId]: true,
          },
          highlightedTicketId: ticketId,
        });

        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const el = document.getElementById(`ticket-${ticketId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);

          setTimeout(() => {
            if (get().highlightedTicketId === ticketId) {
              set({ highlightedTicketId: null });
            }
          }, 4000);
        }
      },

      loadTicketAttachment: async (ticketId: string) => {
        const key = `ticket:${ticketId}`;
        const state = get();
        if (state.decryptedAttachments[key] || state.loadingAttachmentKeys[key]) {
          return;
        }

        set({
          loadingAttachmentKeys: {
            ...get().loadingAttachmentKeys,
            [key]: true,
          },
        });

        try {
          const result = await fetchAndDecryptTicketAttachment(ticketId);
          set({
            decryptedAttachments: {
              ...get().decryptedAttachments,
              [key]: result,
            },
          });
        } catch {
          // Ignore transient fetch errors so user can retry if needed
        } finally {
          set({
            loadingAttachmentKeys: {
              ...get().loadingAttachmentKeys,
              [key]: false,
            },
          });
        }
      },

      loadCommentAttachment: async (ticketId: string, commentId: string) => {
        const key = `comment:${commentId}`;
        const state = get();
        if (state.decryptedAttachments[key] || state.loadingAttachmentKeys[key]) {
          return;
        }

        set({
          loadingAttachmentKeys: {
            ...get().loadingAttachmentKeys,
            [key]: true,
          },
        });

        try {
          const result = await fetchAndDecryptCommentAttachment(ticketId, commentId);
          set({
            decryptedAttachments: {
              ...get().decryptedAttachments,
              [key]: result,
            },
          });
        } catch {
          // Ignore transient fetch errors
        } finally {
          set({
            loadingAttachmentKeys: {
              ...get().loadingAttachmentKeys,
              [key]: false,
            },
          });
        }
      },

      ensureTicketAttachmentsLoaded: async (ticket: Ticket) => {
        const tasks: Promise<void>[] = [];
        if (ticket.hasAttachment) {
          tasks.push(get().loadTicketAttachment(ticket.id));
        }
        if (Array.isArray(ticket.comments)) {
          for (const comment of ticket.comments) {
            if (comment.hasAttachment) {
              tasks.push(get().loadCommentAttachment(ticket.id, comment.id));
            }
          }
        }
        if (tasks.length > 0) {
          await Promise.all(tasks);
        }
      },

      toggleAttachmentVisibility: (key: string) => {
        const current = get().hiddenAttachmentKeys;
        set({
          hiddenAttachmentKeys: {
            ...current,
            [key]: !current[key],
          },
        });
      },

      setLightboxImage: (lightboxImage: DecryptedAttachmentResult | null) => {
        set({ lightboxImage });
      },
    }),
    {
      name: 'ts_tickets',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // PRIVACY & SECURITY: Full ticket entities (customer descriptions, names, emails,
        // comments, attachments) are kept strictly in runtime memory to prevent PII exposure.
        // Only non-PII UI interaction preferences are persisted.
        expandedTicketIds: state.expandedTicketIds,
        viewedTicketIds: state.viewedTicketIds,
        hasInitializedExpansion: state.hasInitializedExpansion,
        portalSearchQuery: state.portalSearchQuery,
      }),
    },
  ),
);
