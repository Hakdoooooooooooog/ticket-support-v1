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

  setAgents: (agents: AuthUser[]) => void;
  setStatusFilter: (statusFilter: string) => void;
  setPriorityFilter: (priorityFilter: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  resetFilters: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      agents: [],
      hasLoadedAgents: false,
      statusFilter: 'ALL',
      priorityFilter: 'ALL',
      searchQuery: '',

      setAgents: (agents: AuthUser[]) => {
        set({
          agents,
          hasLoadedAgents: true,
        });
      },

      setStatusFilter: (statusFilter: string) => set({ statusFilter }),
      setPriorityFilter: (priorityFilter: string) => set({ priorityFilter }),
      setSearchQuery: (searchQuery: string) => set({ searchQuery }),
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
      }),
    },
  ),
);
