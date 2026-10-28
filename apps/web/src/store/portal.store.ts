'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PortalTab = 'tickets' | 'knowledge-base';
export type PortalDepartmentFilter = 'ALL' | 'TECHNICAL_SUPPORT' | 'GENERAL';

export interface PortalState {
  activeTab: PortalTab;
  departmentFilter: PortalDepartmentFilter;
  knowledgeSearchQuery: string;
  expandedArticleIds: Record<string, boolean>;
  feedbackGiven: Record<string, 'helpful' | 'unhelpful'>;
  deflectionCount: number;
  lastDeflectedArticleTitle: string | null;
  prefillDraft: {
    title: string;
    department: 'TECHNICAL_SUPPORT' | 'GENERAL';
  } | null;

  setActiveTab: (tab: PortalTab) => void;
  setDepartmentFilter: (filter: PortalDepartmentFilter) => void;
  setKnowledgeSearchQuery: (query: string) => void;
  toggleArticleExpanded: (id: string) => void;
  setArticleExpanded: (id: string, expanded: boolean) => void;
  rateArticleHelpful: (id: string, isHelpful: boolean) => void;
  recordDeflection: (articleTitle: string) => void;
  clearLastDeflectionNotice: () => void;
  prefillTicketFromArticle: (title: string, department: 'TECHNICAL_SUPPORT' | 'GENERAL') => void;
  clearPrefillDraft: () => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set, get) => ({
      activeTab: 'tickets',
      departmentFilter: 'ALL',
      knowledgeSearchQuery: '',
      expandedArticleIds: {},
      feedbackGiven: {},
      deflectionCount: 0,
      lastDeflectedArticleTitle: null,
      prefillDraft: null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      setDepartmentFilter: (departmentFilter) => set({ departmentFilter }),

      setKnowledgeSearchQuery: (knowledgeSearchQuery) => set({ knowledgeSearchQuery }),

      toggleArticleExpanded: (id) =>
        set((state) => ({
          expandedArticleIds: {
            ...state.expandedArticleIds,
            [id]: !state.expandedArticleIds[id],
          },
        })),

      setArticleExpanded: (id, expanded) =>
        set((state) => ({
          expandedArticleIds: {
            ...state.expandedArticleIds,
            [id]: expanded,
          },
        })),

      rateArticleHelpful: (id, isHelpful) =>
        set((state) => ({
          feedbackGiven: {
            ...state.feedbackGiven,
            [id]: isHelpful ? 'helpful' : 'unhelpful',
          },
        })),

      recordDeflection: (articleTitle) =>
        set((state) => ({
          deflectionCount: state.deflectionCount + 1,
          lastDeflectedArticleTitle: articleTitle,
        })),

      clearLastDeflectionNotice: () => set({ lastDeflectedArticleTitle: null }),

      prefillTicketFromArticle: (title, department) =>
        set({
          activeTab: 'tickets',
          prefillDraft: {
            title: `Assistance needed: ${title}`,
            department,
          },
        }),

      clearPrefillDraft: () => set({ prefillDraft: null }),
    }),
    {
      name: 'ts_portal_state',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        feedbackGiven: state.feedbackGiven,
        deflectionCount: state.deflectionCount,
        departmentFilter: state.departmentFilter,
      }),
    },
  ),
);
