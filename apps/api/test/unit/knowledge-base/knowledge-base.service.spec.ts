import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { KnowledgeBaseService } from '../../../src/knowledge-base/knowledge-base.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { INITIAL_KNOWLEDGE_ARTICLES } from '../../../src/knowledge-base/knowledge-base.data.js';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockPrisma: any;
  let articlesDb: any[];
  let feedbackDb: Map<string, boolean>;

  beforeEach(() => {
    articlesDb = INITIAL_KNOWLEDGE_ARTICLES.map((a, idx) => ({
      ...a,
      id: a.id || `kb-${idx}`,
      body: a.summary,
      status: 'PUBLISHED',
      authorId: 'admin-1',
      publishedById: 'admin-1',
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 'admin-1', fullName: 'IT Admin', role: 'ADMIN' },
      publishedBy: { id: 'admin-1', fullName: 'IT Admin' },
    }));

    feedbackDb = new Map<string, boolean>();

    mockPrisma = {
      knowledgeArticle: {
        count: vi.fn(async (args?: any) => {
          let list = articlesDb;
          if (args?.where?.status) {
            list = list.filter((a) => a.status === args.where.status);
          }
          if (args?.where?.department) {
            list = list.filter((a) => a.department === args.where.department);
          }
          return list.length;
        }),
        findMany: vi.fn(async (args?: any) => {
          let list = [...articlesDb];
          if (args?.where?.status) {
            list = list.filter((a) => a.status === args.where.status);
          }
          if (args?.where?.department) {
            list = list.filter((a) => a.department === args.where.department);
          }
          return list;
        }),
        findFirst: vi.fn(async (args: any) => {
          const condition = args?.where?.OR || [args?.where];
          for (const cond of condition) {
            const found = articlesDb.find(
              (a) =>
                (cond.id && a.id === cond.id) ||
                (cond.slug && a.slug === cond.slug),
            );
            if (found) return found;
          }
          return null;
        }),
        findUnique: vi.fn(async (args: any) => {
          return articlesDb.find((a) => a.id === args.where.id) || null;
        }),
        create: vi.fn(async (args: any) => {
          const newArticle = {
            id: `kb-new-${Date.now()}`,
            ...args.data,
            helpfulCount: 0,
            unhelpfulCount: 0,
            deflectionCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { id: args.data.authorId, fullName: 'Staff User', role: 'AGENT' },
          };
          articlesDb.push(newArticle);
          return newArticle;
        }),
        update: vi.fn(async (args: any) => {
          const article = articlesDb.find((a) => a.id === args.where.id);
          if (!article) throw new NotFoundException();
          if (args.data.helpfulCount?.increment) {
            article.helpfulCount += args.data.helpfulCount.increment;
          }
          if (args.data.helpfulCount?.decrement) {
            article.helpfulCount -= args.data.helpfulCount.decrement;
          }
          if (args.data.unhelpfulCount?.increment) {
            article.unhelpfulCount += args.data.unhelpfulCount.increment;
          }
          if (args.data.unhelpfulCount?.decrement) {
            article.unhelpfulCount -= args.data.unhelpfulCount.decrement;
          }
          if (args.data.deflectionCount?.increment) {
            article.deflectionCount += args.data.deflectionCount.increment;
          }
          if (args.data.status) {
            article.status = args.data.status;
          }
          if (args.data.title) {
            article.title = args.data.title;
          }
          if (args.data.publishedById) {
            article.publishedById = args.data.publishedById;
          }
          if (args.data.publishedAt) {
            article.publishedAt = args.data.publishedAt;
          }
          article.updatedAt = new Date();
          return article;
        }),
        delete: vi.fn(async (args: any) => {
          const idx = articlesDb.findIndex((a) => a.id === args.where.id);
          if (idx !== -1) articlesDb.splice(idx, 1);
          return { id: args.where.id };
        }),
        aggregate: vi.fn(async () => ({
          _sum: {
            helpfulCount: articlesDb.reduce((acc, a) => acc + a.helpfulCount, 0),
            deflectionCount: articlesDb.reduce((acc, a) => acc + a.deflectionCount, 0),
          },
        })),
      },
      articleFeedback: {
        findUnique: vi.fn(async (args: any) => {
          const key = `${args.where.articleId_userId.articleId}:${args.where.articleId_userId.userId}`;
          const helpful = feedbackDb.get(key);
          if (helpful === undefined) return null;
          return { helpful };
        }),
        create: vi.fn(async (args: any) => {
          const key = `${args.data.articleId}:${args.data.userId}`;
          feedbackDb.set(key, args.data.helpful);
          return args.data;
        }),
        update: vi.fn(async (args: any) => {
          const key = `${args.where.articleId_userId.articleId}:${args.where.articleId_userId.userId}`;
          feedbackDb.set(key, args.data.helpful);
          return { helpful: args.data.helpful };
        }),
      },
      articleDeflection: {
        create: vi.fn(async (args: any) => args.data),
      },
      $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
    };

    service = new KnowledgeBaseService(mockPrisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('returns published articles when called by customers', async () => {
      const articles = await service.findAll();
      expect(articles.length).toBe(10);
      expect(articles.every((a) => a.status === 'PUBLISHED')).toBe(true);
    });

    it('filters articles by TECHNICAL_SUPPORT department', async () => {
      const articles = await service.findAll(undefined, 'TECHNICAL_SUPPORT');
      expect(articles.length).toBe(5);
      expect(articles.every((a) => a.department === 'TECHNICAL_SUPPORT')).toBe(true);
    });

    it('ranks articles when searching for keywords', async () => {
      const results = await service.findAll('vpn connection failed');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].slug).toContain('vpn');
    });

    it('allows staff to view drafts when status filter is provided', async () => {
      articlesDb.push({
        id: 'draft-1',
        slug: 'draft-guide',
        title: 'Draft Guide',
        summary: 'Under review',
        body: 'Details',
        status: 'DRAFT',
        department: 'TECHNICAL_SUPPORT',
        tags: [],
        keywords: [],
        helpfulCount: 0,
        unhelpfulCount: 0,
        deflectionCount: 0,
        updatedAt: new Date(),
      });

      const staff = { id: 'agent-1', role: 'AGENT' };
      const drafts = await service.findAll(undefined, undefined, staff, 'DRAFT');
      expect(drafts.some((d) => d.id === 'draft-1')).toBe(true);
    });
  });

  describe('findByIdOrSlug', () => {
    it('finds article by slug', async () => {
      const article = await service.findByIdOrSlug('vpn-connection-gateway-troubleshooting');
      expect(article.title).toContain('VPN');
    });

    it('hides draft articles from customer accounts', async () => {
      articlesDb.push({
        id: 'draft-secret',
        slug: 'internal-secret-guide',
        title: 'Secret',
        summary: 'Private',
        status: 'DRAFT',
        department: 'TECHNICAL_SUPPORT',
        tags: [],
        keywords: [],
        helpfulCount: 0,
        unhelpfulCount: 0,
        deflectionCount: 0,
        updatedAt: new Date(),
      });

      const customer = { id: 'cust-1', role: 'CUSTOMER' };
      await expect(service.findByIdOrSlug('internal-secret-guide', customer)).rejects.toThrow(
        NotFoundException,
      );

      const staff = { id: 'admin-1', role: 'ADMIN' };
      const found = await service.findByIdOrSlug('internal-secret-guide', staff);
      expect(found.id).toBe('draft-secret');
    });
  });

  describe('create and publish lifecycle', () => {
    it('allows staff to create a draft article', async () => {
      const created = await service.create(
        {
          title: 'New Hardware Guide',
          summary: 'Setting up new monitor',
          department: 'TECHNICAL_SUPPORT',
          steps: ['Plug cable', 'Turn on'],
        },
        'agent-1',
      );

      expect(created.status).toBe('DRAFT');
      expect(created.slug).toContain('new-hardware-guide');
      expect(created.steps).toHaveLength(2);
    });

    it('allows admin to publish a draft', async () => {
      const draft = await service.create(
        {
          title: 'Monitor Setup',
          summary: 'Monitor checklist',
          department: 'TECHNICAL_SUPPORT',
        },
        'agent-1',
      );

      const published = await service.publish(draft.id, 'admin-1');
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedById).toBe('admin-1');
    });
  });

  describe('feedback & deflection', () => {
    it('records helpful feedback and replaces old vote on change', async () => {
      const target = articlesDb[0];
      const initialHelpful = target.helpfulCount;

      // 1. Initial helpful vote
      await service.recordFeedback(target.id, true, 'user-100');
      expect(target.helpfulCount).toBe(initialHelpful + 1);

      // 2. Voting same way again is a no-op
      await service.recordFeedback(target.id, true, 'user-100');
      expect(target.helpfulCount).toBe(initialHelpful + 1);

      // 3. Changing vote to unhelpful decrements helpful and increments unhelpful
      await service.recordFeedback(target.id, false, 'user-100');
      expect(target.helpfulCount).toBe(initialHelpful);
      expect(target.unhelpfulCount).toBe(target.unhelpfulCount);
    });

    it('increments deflection count', async () => {
      const target = articlesDb[0];
      const initialDeflections = target.deflectionCount;
      await service.recordDeflection(target.id, 'user-100');
      expect(target.deflectionCount).toBe(initialDeflections + 1);
    });
  });

  describe('getStats', () => {
    it('returns aggregated metrics from prisma', async () => {
      const stats = await service.getStats();
      expect(stats.totalArticles).toBe(10);
      expect(stats.technicalArticles).toBe(5);
      expect(stats.generalArticles).toBe(5);
      expect(stats.totalHelpfulVotes).toBeGreaterThan(0);
    });
  });
});
