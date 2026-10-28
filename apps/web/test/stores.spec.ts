import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useTicketsStore } from '../src/store/tickets.store';
import { useAdminStore } from '../src/store/admin.store';
import type { Ticket } from '../src/components/ticket-list';

// Provide a mock sessionStorage for zustand persist middleware in Node environment
beforeAll(() => {
  const store: Record<string, string> = {};
  globalThis.sessionStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (i: number) => Object.keys(store)[i] || null,
    length: Object.keys(store).length,
  };
});

describe('Web State Management Stores (Zustand)', () => {
  beforeEach(() => {
    useTicketsStore.getState().clearTickets();
  });

  describe('TicketsStore', () => {
    const mockTicket: Ticket = {
      id: 'ticket-1',
      title: 'Email client not syncing',
      description: 'Outlook cannot reach exchange server',
      status: 'OPEN',
      priority: 'MEDIUM',
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T10:00:00Z',
      creatorId: 'user-1',
    };

    it('sets tickets and maintains loaded state', () => {
      const store = useTicketsStore.getState();
      expect(store.hasLoadedTickets).toBe(false);

      store.setTickets([mockTicket]);
      const updated = useTicketsStore.getState();
      expect(updated.hasLoadedTickets).toBe(true);
      expect(updated.tickets).toHaveLength(1);
      expect(updated.tickets[0].id).toBe('ticket-1');
    });

    it('toggles expansion state for individual tickets', () => {
      const store = useTicketsStore.getState();
      expect(store.expandedTicketIds['ticket-1']).toBeUndefined();

      store.toggleTicketExpanded('ticket-1');
      expect(useTicketsStore.getState().expandedTicketIds['ticket-1']).toBe(true);

      store.toggleTicketExpanded('ticket-1');
      expect(useTicketsStore.getState().expandedTicketIds['ticket-1']).toBe(false);
    });

    it('toggles bulk expansion for all tickets', () => {
      const store = useTicketsStore.getState();
      const mockTicketsList: Ticket[] = [
        mockTicket,
        {
          id: 'ticket-2',
          title: 'VPN fail',
          description: 'desc',
          status: 'OPEN',
          priority: 'HIGH',
          createdAt: '2026-10-27T10:00:00Z',
          updatedAt: '2026-10-27T10:00:00Z',
        },
      ];

      store.setAllTicketsExpanded(mockTicketsList, true);
      const state = useTicketsStore.getState();
      expect(state.expandedTicketIds['ticket-1']).toBe(true);
      expect(state.expandedTicketIds['ticket-2']).toBe(true);

      store.setAllTicketsExpanded(mockTicketsList, false);
      const collapsed = useTicketsStore.getState();
      expect(collapsed.expandedTicketIds['ticket-1']).toBeUndefined();
    });

    it('optimistically upserts new tickets and updates existing records', () => {
      const store = useTicketsStore.getState();
      store.setTickets([mockTicket]);

      // Update existing ticket
      const modified: Ticket = { ...mockTicket, status: 'IN_PROGRESS' };
      store.upsertTicket(modified);
      expect(useTicketsStore.getState().tickets[0].status).toBe('IN_PROGRESS');

      // Insert brand new ticket
      const newTicket: Ticket = {
        id: 'ticket-2',
        title: 'Network down',
        description: 'No wifi',
        status: 'OPEN',
        priority: 'URGENT',
        createdAt: '2026-10-27T11:00:00Z',
        updatedAt: '2026-10-27T11:00:00Z',
      };
      store.upsertTicket(newTicket);
      expect(useTicketsStore.getState().tickets).toHaveLength(2);
      expect(useTicketsStore.getState().tickets[0].id).toBe('ticket-2'); // newly inserted at top
    });

    it('optimistically removes tickets by ID', () => {
      const store = useTicketsStore.getState();
      store.setTickets([mockTicket]);
      expect(useTicketsStore.getState().tickets).toHaveLength(1);

      store.removeTicket('ticket-1');
      expect(useTicketsStore.getState().tickets).toHaveLength(0);
    });

    it('toggles attachment visibility state', () => {
      const store = useTicketsStore.getState();
      expect(store.hiddenAttachmentKeys['ticket-1-root']).toBeUndefined();

      store.toggleAttachmentVisibility('ticket-1-root');
      expect(useTicketsStore.getState().hiddenAttachmentKeys['ticket-1-root']).toBe(true);

      store.toggleAttachmentVisibility('ticket-1-root');
      expect(useTicketsStore.getState().hiddenAttachmentKeys['ticket-1-root']).toBe(false);
    });
  });

  describe('AdminStore', () => {
    it('updates active section navigation', () => {
      const store = useAdminStore.getState();
      store.setActiveSection('ALL_TICKETS');
      expect(useAdminStore.getState().activeSection).toBe('ALL_TICKETS');

      store.setActiveSection('TEAM_MANAGEMENT');
      expect(useAdminStore.getState().activeSection).toBe('TEAM_MANAGEMENT');
    });

    it('updates queue filtering criteria', () => {
      const store = useAdminStore.getState();
      store.setStatusFilter('OPEN');
      store.setPriorityFilter('URGENT');
      store.setSearchQuery('wifi');

      const state = useAdminStore.getState();
      expect(state.statusFilter).toBe('OPEN');
      expect(state.priorityFilter).toBe('URGENT');
      expect(state.searchQuery).toBe('wifi');
    });

    it('manages follow-up composer state and prompts', () => {
      const store = useAdminStore.getState();
      store.openFollowUpComposer('ticket-101');

      let state = useAdminStore.getState();
      expect(state.followUpTicketId).toBe('ticket-101');
      expect(state.followUpPrompt).toBe('');

      store.setFollowUpPrompt('Please provide error code');
      expect(useAdminStore.getState().followUpPrompt).toBe('Please provide error code');

      store.closeFollowUpComposer();
      state = useAdminStore.getState();
      expect(state.followUpTicketId).toBeNull();
      expect(state.followUpPrompt).toBe('');
    });

    it('stores per-ticket comment drafts', () => {
      const store = useAdminStore.getState();
      store.setCommentDraft('ticket-1', 'Initial draft for ticket 1');
      expect(useAdminStore.getState().commentDrafts['ticket-1']).toBe('Initial draft for ticket 1');
    });
  });
});
