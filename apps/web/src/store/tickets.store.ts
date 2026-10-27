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
  hasInitializedExpansion: boolean;
  portalSearchQuery: string;

  // On-demand attachment cache (keyed by `ticket:${ticketId}` or `comment:${commentId}`)
  decryptedAttachments: Record<string, DecryptedAttachmentResult>;
  loadingAttachmentKeys: Record<string, boolean>;
  hiddenAttachmentKeys: Record<string, boolean>;

  setTickets: (tickets: Ticket[]) => void;
  upsertTicket: (ticket: Ticket) => void;
  removeTicket: (id: string) => void;
  clearTickets: () => void;

  setPortalSearchQuery: (query: string) => void;
  initializeDefaultExpansion: (tickets: Ticket[]) => void;
  toggleTicketExpanded: (ticketId: string) => void;
  setTicketExpanded: (ticketId: string, expanded: boolean) => void;
  setAllTicketsExpanded: (tickets: Ticket[], expanded: boolean) => void;

  loadTicketAttachment: (ticketId: string) => Promise<void>;
  loadCommentAttachment: (ticketId: string, commentId: string) => Promise<void>;
  ensureTicketAttachmentsLoaded: (ticket: Ticket) => Promise<void>;
  toggleAttachmentVisibility: (key: string) => void;
}

export const useTicketsStore = create<TicketsState>()(
  persist(
    (set, get) => ({
      tickets: [],
      hasLoadedTickets: false,
      lastUpdatedAt: null,

      expandedTicketIds: {},
      hasInitializedExpansion: false,
      portalSearchQuery: '',

      decryptedAttachments: {},
      loadingAttachmentKeys: {},
      hiddenAttachmentKeys: {},

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
        tickets.forEach((ticket, idx) => {
          if (idx === 0 || ticket.status === 'NEEDS_INFO') {
            initial[ticket.id] = true;
          }
        });
        set({
          expandedTicketIds: initial,
          hasInitializedExpansion: true,
        });
      },

      toggleTicketExpanded: (ticketId: string) => {
        const current = get().expandedTicketIds;
        set({
          expandedTicketIds: {
            ...current,
            [ticketId]: !current[ticketId],
          },
        });
      },

      setTicketExpanded: (ticketId: string, expanded: boolean) => {
        set({
          expandedTicketIds: {
            ...get().expandedTicketIds,
            [ticketId]: expanded,
          },
        });
      },

      setAllTicketsExpanded: (tickets: Ticket[], expanded: boolean) => {
        if (!expanded) {
          set({ expandedTicketIds: {} });
          return;
        }
        const next: Record<string, boolean> = {};
        tickets.forEach((t) => {
          next[t.id] = true;
        });
        set({ expandedTicketIds: next });
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
    }),
    {
      name: 'ts_zustand_tickets_store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        tickets: state.tickets,
        hasLoadedTickets: state.hasLoadedTickets,
        lastUpdatedAt: state.lastUpdatedAt,
        expandedTicketIds: state.expandedTicketIds,
        hasInitializedExpansion: state.hasInitializedExpansion,
        portalSearchQuery: state.portalSearchQuery,
      }),
    },
  ),
);
