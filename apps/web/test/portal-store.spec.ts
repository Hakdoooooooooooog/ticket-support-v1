import { describe, it, expect, beforeEach } from 'vitest';
import { usePortalStore } from '../src/store/portal.store';

describe('Portal Store (Zustand)', () => {
  beforeEach(() => {
    usePortalStore.setState({
      activeTab: 'tickets',
      departmentFilter: 'ALL',
      knowledgeSearchQuery: '',
      expandedArticleIds: {},
      feedbackGiven: {},
      deflectionCount: 0,
      lastDeflectedArticleTitle: null,
      prefillDraft: null,
    });
  });

  it('switches tabs between tickets and knowledge base', () => {
    expect(usePortalStore.getState().activeTab).toBe('tickets');
    usePortalStore.getState().setActiveTab('knowledge-base');
    expect(usePortalStore.getState().activeTab).toBe('knowledge-base');
  });

  it('updates department filter', () => {
    usePortalStore.getState().setDepartmentFilter('TECHNICAL_SUPPORT');
    expect(usePortalStore.getState().departmentFilter).toBe('TECHNICAL_SUPPORT');
    usePortalStore.getState().setDepartmentFilter('GENERAL');
    expect(usePortalStore.getState().departmentFilter).toBe('GENERAL');
  });

  it('toggles article expansion', () => {
    expect(usePortalStore.getState().expandedArticleIds['kb-vpn-01']).toBeFalsy();
    usePortalStore.getState().toggleArticleExpanded('kb-vpn-01');
    expect(usePortalStore.getState().expandedArticleIds['kb-vpn-01']).toBe(true);
    usePortalStore.getState().toggleArticleExpanded('kb-vpn-01');
    expect(usePortalStore.getState().expandedArticleIds['kb-vpn-01']).toBe(false);
  });

  it('records helpful feedback on articles', () => {
    usePortalStore.getState().rateArticleHelpful('kb-vpn-01', true);
    expect(usePortalStore.getState().feedbackGiven['kb-vpn-01']).toBe('helpful');
    usePortalStore.getState().rateArticleHelpful('kb-vpn-01', false);
    expect(usePortalStore.getState().feedbackGiven['kb-vpn-01']).toBe('unhelpful');
  });

  it('records deflection events and increments count', () => {
    expect(usePortalStore.getState().deflectionCount).toBe(0);
    usePortalStore.getState().recordDeflection('VPN Connection & Gateway Troubleshooting');
    expect(usePortalStore.getState().deflectionCount).toBe(1);
    expect(usePortalStore.getState().lastDeflectedArticleTitle).toBe(
      'VPN Connection & Gateway Troubleshooting',
    );
  });

  it('sets prefillDraft and switches tab to tickets when article escalation is triggered', () => {
    usePortalStore.getState().setActiveTab('knowledge-base');
    usePortalStore
      .getState()
      .prefillTicketFromArticle('Email Sync Issue', 'TECHNICAL_SUPPORT');

    const state = usePortalStore.getState();
    expect(state.activeTab).toBe('tickets');
    expect(state.prefillDraft).toEqual({
      title: 'Assistance needed: Email Sync Issue',
      department: 'TECHNICAL_SUPPORT',
    });

    state.clearPrefillDraft();
    expect(usePortalStore.getState().prefillDraft).toBeNull();
  });
});
