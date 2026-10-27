'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '@lib/helpers';

export interface AdminState {
  agents: AuthUser[];
  hasLoadedAgents: boolean;
  statusFilter: string;
  priorityFilter: string;
  searchQuery: string;

  // Admin Triage & Composer UI state in Zustand
  commentDrafts: Record<string, string>;
  followUpTicketId: string | null;
  followUpPrompt: string;

  setAgents: (agents: AuthUser[]) => void;
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
          searchQuery: '',
        }),
    }),
    {
      name: 'ts_zustand_admin_store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        agents: state.agents,
        hasLoadedAgents: state.hasLoadedAgents,
        statusFilter: state.statusFilter,
        priorityFilter: state.priorityFilter,
        commentDrafts: state.commentDrafts,
      }),
    },
  ),
);
