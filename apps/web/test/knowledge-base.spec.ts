import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_BASE_ARTICLES,
  searchKnowledgeBaseArticles,
} from '../src/lib/knowledge-base';

describe('Knowledge Base & Deflection Engine (Web)', () => {
  it('contains 10 curated articles spanning Technical Support and General scope', () => {
    expect(KNOWLEDGE_BASE_ARTICLES.length).toBe(10);
    const techArticles = KNOWLEDGE_BASE_ARTICLES.filter((a) => a.department === 'TECHNICAL_SUPPORT');
    const generalArticles = KNOWLEDGE_BASE_ARTICLES.filter((a) => a.department === 'GENERAL');
    expect(techArticles.length).toBe(5);
    expect(generalArticles.length).toBe(5);
  });

  it('accurately identifies VPN troubleshooting when searching for "vpn disconnected"', () => {
    const results = searchKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, 'vpn disconnected');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.id).toBe('kb-vpn-01');
    expect(results[0].score).toBeGreaterThanOrEqual(10);
  });

  it('accurately identifies SSO/2FA guide when searching for "authenticator code login"', () => {
    const results = searchKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, 'authenticator code login');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.id).toBe('kb-sso-02');
  });

  it('accurately identifies invoice retrieval for general inquiry "download past billing invoice"', () => {
    const results = searchKnowledgeBaseArticles(
      KNOWLEDGE_BASE_ARTICLES,
      'download past billing invoice',
      'GENERAL',
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].article.id).toBe('kb-invoice-06');
    expect(results[0].article.department).toBe('GENERAL');
  });

  it('returns empty results for empty or stop-word-only queries', () => {
    expect(searchKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, '')).toHaveLength(10);
    expect(searchKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, '   ')).toHaveLength(10);
    expect(searchKnowledgeBaseArticles(KNOWLEDGE_BASE_ARTICLES, 'a to in')).toHaveLength(0);
  });

  it('boosts department score when matching requested department', () => {
    const techResults = searchKnowledgeBaseArticles(
      KNOWLEDGE_BASE_ARTICLES,
      'network connection',
      'TECHNICAL_SUPPORT',
    );
    const untypedResults = searchKnowledgeBaseArticles(
      KNOWLEDGE_BASE_ARTICLES,
      'network connection',
    );
    const techScore = techResults.find((r) => r.article.id === 'kb-vpn-01')?.score || 0;
    const baseScore = untypedResults.find((r) => r.article.id === 'kb-vpn-01')?.score || 0;
    expect(techScore).toBeGreaterThan(baseScore);
  });
});
