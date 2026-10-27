'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Ticket } from '@components/ticket-list';

export interface TicketsState {
  tickets: Ticket[];
  hasLoadedTickets: boolean;
  lastUpdatedAt: string | null;

  setTickets: (tickets: Ticket[]) => void;
  upsertTicket: (ticket: Ticket) => void;
  removeTicket: (id: string) => void;
  clearTickets: () => void;
}

export const useTicketsStore = create<TicketsState>()(
  persist(
    (set, get) => ({
      tickets: [],
      hasLoadedTickets: false,
      lastUpdatedAt: null,

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
      }),
    },
  ),
);
