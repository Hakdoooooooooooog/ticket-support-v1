import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseService } from '../../../src/knowledge-base/knowledge-base.service.js';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;

  beforeEach(() => {
    service = new KnowledgeBaseService();
  });

  describe('findAll', () => {
    it('returns all articles when no search or department filter is provided', async () => {
      const articles = await service.findAll();
      expect(articles.length).toBe(10);
    });

    it('filters articles strictly by TECHNICAL_SUPPORT department', async () => {
      const articles = await service.findAll(undefined, 'TECHNICAL_SUPPORT');
      expect(articles.length).toBe(5);
      expect(articles.every((a) => a.department === 'TECHNICAL_SUPPORT')).toBe(true);
    });

    it('filters articles strictly by GENERAL department', async () => {
      const articles = await service.findAll(undefined, 'GENERAL');
      expect(articles.length).toBe(5);
      expect(articles.every((a) => a.department === 'GENERAL')).toBe(true);
    });

    it('ranks articles correctly when searching for "vpn"', async () => {
      const results = await service.findAll('vpn connection failed');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('kb-vpn-01');
    });

    it('ranks billing articles when searching for "invoice"', async () => {
      const results = await service.findAll('download billing invoice');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('kb-invoice-06');
    });
  });

  describe('findByIdOrSlug', () => {
    it('finds article by ID', async () => {
      const article = await service.findByIdOrSlug('kb-vpn-01');
      expect(article.title).toContain('VPN');
    });

    it('finds article by slug', async () => {
      const article = await service.findByIdOrSlug('sso-2fa-reset-authentication-guide');
      expect(article.id).toBe('kb-sso-02');
    });

    it('throws NotFoundException when article does not exist', async () => {
      await expect(service.findByIdOrSlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordFeedback', () => {
    it('increments helpfulCount when positive', async () => {
      const initial = await service.findByIdOrSlug('kb-vpn-01');
      const startCount = initial.helpfulCount;
      const updated = await service.recordFeedback('kb-vpn-01', true);
      expect(updated.helpfulCount).toBe(startCount + 1);
    });

    it('increments unhelpfulCount when negative', async () => {
      const initial = await service.findByIdOrSlug('kb-vpn-01');
      const startCount = initial.unhelpfulCount;
      const updated = await service.recordFeedback('kb-vpn-01', false);
      expect(updated.unhelpfulCount).toBe(startCount + 1);
    });
  });

  describe('recordDeflection', () => {
    it('increments deflection count when user resolves issue via self-service', async () => {
      const initial = await service.findByIdOrSlug('kb-vpn-01');
      const startDeflections = initial.deflectionCount;
      const updated = await service.recordDeflection('kb-vpn-01');
      expect(updated.deflectionCount).toBe(startDeflections + 1);
    });
  });

  describe('getStats', () => {
    it('returns calculated metrics across all articles', async () => {
      const stats = await service.getStats();
      expect(stats.totalArticles).toBe(10);
      expect(stats.technicalArticles).toBe(5);
      expect(stats.generalArticles).toBe(5);
      expect(stats.totalHelpfulVotes).toBeGreaterThan(0);
      expect(stats.totalDeflections).toBeGreaterThan(0);
    });
  });
});
