import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useTicketsStore } from '../src/store/tickets.store';
import { useAdminStore } from '../src/store/admin.store';
import { useAuthStore } from '../src/store/auth.store';
import type { Ticket } from '../src/components/ticket-list';

// Provide a mock sessionStorage & localStorage for zustand persist middleware in Node environment
const mockSessionStorage: Record<string, string> = {};
const mockLocalStorage: Record<string, string> = {};

beforeAll(() => {
  const createMockStorage = (store: Record<string, string>) => ({
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
  });

  globalThis.sessionStorage = createMockStorage(mockSessionStorage);
  globalThis.localStorage = createMockStorage(mockLocalStorage);
  (globalThis as any).window = globalThis;
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

    it('toggles comment history expansion state', () => {
      const store = useTicketsStore.getState();
      expect(store.expandedCommentHistories['ticket-1']).toBeUndefined();

      store.toggleCommentHistory('ticket-1');
      expect(useTicketsStore.getState().expandedCommentHistories['ticket-1']).toBe(true);

      store.toggleCommentHistory('ticket-1');
      expect(useTicketsStore.getState().expandedCommentHistories['ticket-1']).toBe(false);
    });

    it('highlights and expands a targeted ticket from notifications', () => {
      const store = useTicketsStore.getState();
      expect(store.highlightedTicketId).toBeNull();
      expect(store.expandedTicketIds['ticket-target']).toBeUndefined();

      store.highlightTicket('ticket-target');
      const state = useTicketsStore.getState();
      expect(state.highlightedTicketId).toBe('ticket-target');
      expect(state.expandedTicketIds['ticket-target']).toBe(true);

      store.setHighlightedTicketId(null);
      expect(useTicketsStore.getState().highlightedTicketId).toBeNull();
    });

    it('manages viewed and unviewed ticket state for color variant highlighting', () => {
      const store = useTicketsStore.getState();
      expect(store.viewedTicketIds['ticket-new']).toBeUndefined();

      // Expanding ticket marks it viewed automatically
      store.toggleTicketExpanded('ticket-new');
      expect(useTicketsStore.getState().viewedTicketIds['ticket-new']).toBe(true);

      // Manual toggle to unviewed
      store.markTicketUnviewed('ticket-new');
      expect(useTicketsStore.getState().viewedTicketIds['ticket-new']).toBeUndefined();

      // Explicit mark as viewed
      store.markTicketViewed('ticket-new');
      expect(useTicketsStore.getState().viewedTicketIds['ticket-new']).toBe(true);

      // Bulk marking
      store.markAllTicketsViewed([
        mockTicket,
        {
          id: 'ticket-bulk-2',
          title: 'Bulk 2',
          description: 'desc',
          status: 'OPEN',
          priority: 'LOW',
          createdAt: '2026-10-27T10:00:00Z',
          updatedAt: '2026-10-27T10:00:00Z',
        },
      ]);
      const bulkState = useTicketsStore.getState();
      expect(bulkState.viewedTicketIds['ticket-1']).toBe(true);
      expect(bulkState.viewedTicketIds['ticket-bulk-2']).toBe(true);
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

  describe('AuthStore', () => {
    beforeEach(() => {
      useAuthStore.getState().clearSession();
    });

    it('sets session and retains accessToken strictly in-memory without sessionStorage persistence', () => {
      const store = useAuthStore.getState();
      const mockSession = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_value',
        user: {
          id: 'admin-1',
          email: 'admin@ticketsupport.local',
          fullName: 'Alex Rivera (IT Admin)',
          role: 'ADMIN' as const,
        },
      };

      store.setSession(mockSession);

      const activeState = useAuthStore.getState();
      expect(activeState.accessToken).toBe(mockSession.accessToken);
      expect(activeState.user?.email).toBe('admin@ticketsupport.local');
      expect(activeState.isSessionVerified).toBe(true);

      // Verify that zustand persist partialize NEVER wrote accessToken to sessionStorage
      const persistedRaw = mockSessionStorage['ts_zustand_auth_store'];
      if (persistedRaw) {
        expect(persistedRaw).not.toContain('"accessToken"');
        expect(persistedRaw).not.toContain(mockSession.accessToken);
        const parsed = JSON.parse(persistedRaw);
        expect(parsed.state.accessToken).toBeUndefined();
        expect(parsed.state.user.id).toBe('admin-1');
      }
    });

    it('clears session and scrubs stored credentials', () => {
      const store = useAuthStore.getState();
      store.setSession({
        accessToken: 'temp-token',
        user: {
          id: 'user-1',
          email: 'agent@test.local',
          fullName: 'Agent Smith',
          role: 'AGENT' as const,
        },
      });

      store.clearSession();

      const cleared = useAuthStore.getState();
      expect(cleared.user).toBeNull();
      expect(cleared.accessToken).toBeNull();
      expect(cleared.isSessionVerified).toBe(false);
    });
  });
});
