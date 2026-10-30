'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '@lib/helpers';

export type AdminSection =
  | 'DASHBOARD'
  | 'ALL_TICKETS'
  | 'ASSIGNED_TICKETS'
  | 'TEAM_MANAGEMENT'
  | 'CANNED_RESPONSES'
  | 'REPORTS'
  | 'KNOWLEDGE_BASE'
  | 'INCIDENT_BANNERS'
  | 'AUDIT_LOGS'
  | 'SLA_POLICIES';

export interface AdminState {
  agents: AuthUser[];
  hasLoadedAgents: boolean;

  // Navigation section & scope state in Zustand
  activeSection: AdminSection;
  assignedScope: 'MINE' | 'ALL_ASSIGNED' | string;
  assignmentFilter: 'ALL' | 'UNASSIGNED' | 'ASSIGNED';

  statusFilter: string;
  priorityFilter: string;
  searchQuery: string;

  // Admin Triage & Composer UI state in Zustand
  commentDrafts: Record<string, string>;
  followUpTicketId: string | null;
  followUpPrompt: string;

  setAgents: (agents: AuthUser[]) => void;
  setActiveSection: (section: AdminSection) => void;
  setAssignedScope: (scope: 'MINE' | 'ALL_ASSIGNED' | string) => void;
  setAssignmentFilter: (filter: 'ALL' | 'UNASSIGNED' | 'ASSIGNED') => void;
  setStatusFilter: (statusFilter: string) => void;
  setPriorityFilter: (priorityFilter: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  setCommentDraft: (ticketId: string, draft: string) => void;
  openFollowUpComposer: (ticketId: string) => void;
  closeFollowUpComposer: () => void;
  setFollowUpPrompt: (prompt: string) => void;
  resetFilters: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      agents: [],
      hasLoadedAgents: false,

      activeSection: 'DASHBOARD',
      assignedScope: 'MINE',
      assignmentFilter: 'ALL',

      statusFilter: 'ALL',
      priorityFilter: 'ALL',
      searchQuery: '',

      commentDrafts: {},
      followUpTicketId: null,
      followUpPrompt: '',

      setAgents: (agents: AuthUser[]) => {
        set({
          agents,
          hasLoadedAgents: true,
        });
      },

      setActiveSection: (activeSection: AdminSection) => set({ activeSection }),
      setAssignedScope: (assignedScope: 'MINE' | 'ALL_ASSIGNED' | string) =>
        set({ assignedScope }),
      setAssignmentFilter: (assignmentFilter: 'ALL' | 'UNASSIGNED' | 'ASSIGNED') =>
        set({ assignmentFilter }),

      setStatusFilter: (statusFilter: string) => set({ statusFilter }),
      setPriorityFilter: (priorityFilter: string) => set({ priorityFilter }),
      setSearchQuery: (searchQuery: string) => set({ searchQuery }),

      setCommentDraft: (ticketId: string, draft: string) => {
        set({
          commentDrafts: {
            ...get().commentDrafts,
            [ticketId]: draft,
          },
        });
      },

      openFollowUpComposer: (ticketId: string) => {
        set({
          followUpTicketId: ticketId,
          followUpPrompt: '',
        });
      },

      closeFollowUpComposer: () => {
        set({
          followUpTicketId: null,
          followUpPrompt: '',
        });
      },

      setFollowUpPrompt: (followUpPrompt: string) => set({ followUpPrompt }),

      resetFilters: () =>
        set({
          statusFilter: 'ALL',
          priorityFilter: 'ALL',
          assignmentFilter: 'ALL',
          searchQuery: '',
        }),
    }),
    {
      name: 'ts_admin',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return window.sessionStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        // PRIVACY & SECURITY: Staff directory (names, emails) and internal comment drafts
        // are strictly kept in runtime memory to prevent PII exposure in browser storage.
        // Only non-PII dashboard filters and active navigation section are persisted.
        activeSection: state.activeSection,
        assignedScope: state.assignedScope,
        assignmentFilter: state.assignmentFilter,
        statusFilter: state.statusFilter,
        priorityFilter: state.priorityFilter,
        searchQuery: state.searchQuery,
      }),
    },
  ),
);
