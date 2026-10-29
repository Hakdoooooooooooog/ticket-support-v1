import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  KnowledgeArticle,
  KnowledgeBaseStats,
  CreateArticleDto,
  UpdateArticleDto,
} from './knowledge-base.types.js';
import { INITIAL_KNOWLEDGE_ARTICLES } from './knowledge-base.data.js';

@Injectable()
export class KnowledgeBaseService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      if (typeof this.prisma?.knowledgeArticle?.count !== 'function') {
        return;
      }
      const count = await this.prisma.knowledgeArticle.count();
      if (count === 0) {
        let systemAuthor = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
        });

        if (!systemAuthor) {
          systemAuthor = await this.prisma.user.create({
            data: {
              email: 'system.kb@ticketsupport.local',
              fullName: 'Knowledge Base System',
              passwordHash: '$2a$10$eO0...disabled...',
              role: 'ADMIN',
            },
          });
        }

        for (const initial of INITIAL_KNOWLEDGE_ARTICLES) {
          await this.prisma.knowledgeArticle.create({
            data: {
              slug: initial.slug,
              title: initial.title,
              summary: initial.summary,
              body: initial.summary,
              steps: initial.steps || [],
              department: initial.department,
              tags: initial.tags || [],
              keywords: initial.keywords || [],
              status: 'PUBLISHED',
              authorId: systemAuthor.id,
              publishedById: systemAuthor.id,
              publishedAt: new Date(),
              helpfulCount: initial.helpfulCount || 0,
              unhelpfulCount: initial.unhelpfulCount || 0,
              deflectionCount: initial.deflectionCount || 0,
            },
          });
        }
      }
    } catch {
      // Non-blocking in test / migration environments
    }
  }

  async findAll(
    query?: string,
    department?: string,
    actor?: { id: string; role: string },
    statusFilter?: string,
  ): Promise<KnowledgeArticle[]> {
    const isStaff = actor && (actor.role === 'ADMIN' || actor.role === 'AGENT');
    const where: any = {};

    if (isStaff && statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    } else if (!isStaff) {
      where.status = 'PUBLISHED';
    }

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (typeof this.prisma?.knowledgeArticle?.findMany !== 'function') {
      return [];
    }

    const records = await this.prisma.knowledgeArticle.findMany({
      where,
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        publishedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    let mapped = records.map((r) => this.mapRecord(r));

    if (query && query.trim().length > 0) {
      const tokens = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      if (tokens.length > 0) {
        const scored = mapped.map((article) => {
          let score = 0;
          const titleLower = article.title.toLowerCase();
          const summaryLower = article.summary.toLowerCase();
          const tagsLower = article.tags.map((t) => t.toLowerCase());
          const keywordsLower = article.keywords.map((k) => k.toLowerCase());

          for (const token of tokens) {
            if (titleLower.includes(token)) score += 10;
            if (keywordsLower.some((k) => k.includes(token))) score += 8;
            if (tagsLower.some((t) => t.includes(token))) score += 5;
            if (summaryLower.includes(token)) score += 3;
          }

          return { article, score };
        });

        mapped = scored
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.article);
      }
    }

    return mapped;
  }

  async findByIdOrSlug(
    idOrSlug: string,
    actor?: { id: string; role: string },
  ): Promise<KnowledgeArticle> {
    if (typeof this.prisma?.knowledgeArticle?.findFirst !== 'function') {
      throw new NotFoundException(`Knowledge base article '${idOrSlug}' not found.`);
    }

    const record = await this.prisma.knowledgeArticle.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        publishedBy: { select: { id: true, fullName: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Knowledge base article '${idOrSlug}' not found.`);
    }

    const isStaff = actor && (actor.role === 'ADMIN' || actor.role === 'AGENT');
    if (record.status !== 'PUBLISHED' && !isStaff) {
      throw new NotFoundException(`Knowledge base article '${idOrSlug}' not found.`);
    }

    return this.mapRecord(record);
  }

  async create(dto: CreateArticleDto, authorId: string): Promise<KnowledgeArticle> {
    const baseSlug = (dto.title || 'guide')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;

    const created = await this.prisma.knowledgeArticle.create({
      data: {
        slug,
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        body: dto.body?.trim() || dto.summary.trim(),
        steps: dto.steps || [],
        department: dto.department,
        tags: dto.tags || [],
        keywords: dto.keywords || [],
        status: 'DRAFT',
        authorId,
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    });

    return this.mapRecord(created);
  }

  async update(
    id: string,
    dto: UpdateArticleDto,
    actor: { id: string; role: string },
  ): Promise<KnowledgeArticle> {
    const existing = await this.prisma.knowledgeArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Knowledge base article '${id}' not found.`);
    }

    if (actor.role === 'AGENT' && existing.authorId !== actor.id) {
      throw new ForbiddenException('Support agents can only edit their own draft articles.');
    }

    if (actor.role === 'AGENT' && existing.status === 'PUBLISHED') {
      throw new ForbiddenException('Only administrators can modify published articles.');
    }

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.summary ? { summary: dto.summary.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.steps ? { steps: dto.steps } : {}),
        ...(dto.department ? { department: dto.department } : {}),
        ...(dto.tags ? { tags: dto.tags } : {}),
        ...(dto.keywords ? { keywords: dto.keywords } : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        publishedBy: { select: { id: true, fullName: true } },
      },
    });

    return this.mapRecord(updated);
  }

  async publish(id: string, publisherId: string): Promise<KnowledgeArticle> {
    const existing = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Knowledge base article '${id}' not found.`);
    }

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedById: publisherId,
        publishedAt: new Date(),
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        publishedBy: { select: { id: true, fullName: true } },
      },
    });

    return this.mapRecord(updated);
  }

  async archive(id: string): Promise<KnowledgeArticle> {
    const existing = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Knowledge base article '${id}' not found.`);
    }

    const updated = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
        publishedBy: { select: { id: true, fullName: true } },
      },
    });

    return this.mapRecord(updated);
  }

  async delete(id: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.knowledgeArticle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Knowledge base article '${id}' not found.`);
    }

    await this.prisma.knowledgeArticle.delete({ where: { id } });
    return { success: true, id };
  }

  async recordFeedback(
    idOrSlug: string,
    helpful: boolean,
    userId: string,
  ): Promise<KnowledgeArticle> {
    const article = await this.findByIdOrSlug(idOrSlug);

    if (
      typeof this.prisma?.$transaction !== 'function' ||
      typeof this.prisma?.articleFeedback?.findUnique !== 'function'
    ) {
      if (helpful) article.helpfulCount += 1;
      else article.unhelpfulCount += 1;
      article.updatedAt = new Date().toISOString();
      return article;
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.articleFeedback.findUnique({
        where: {
          articleId_userId: {
            articleId: article.id,
            userId,
          },
        },
      });

      if (existing) {
        if (existing.helpful === helpful) {
          // No-op if user voted the same way again
          return article;
        }

        await tx.articleFeedback.update({
          where: {
            articleId_userId: {
              articleId: article.id,
              userId,
            },
          },
          data: { helpful },
        });

        const updated = await tx.knowledgeArticle.update({
          where: { id: article.id },
          data: helpful
            ? {
                helpfulCount: { increment: 1 },
                unhelpfulCount: { decrement: 1 },
              }
            : {
                helpfulCount: { decrement: 1 },
                unhelpfulCount: { increment: 1 },
              },
          include: {
            author: { select: { id: true, fullName: true, role: true } },
            publishedBy: { select: { id: true, fullName: true } },
          },
        });

        return this.mapRecord(updated);
      }

      await tx.articleFeedback.create({
        data: {
          articleId: article.id,
          userId,
          helpful,
        },
      });

      const updated = await tx.knowledgeArticle.update({
        where: { id: article.id },
        data: helpful
          ? { helpfulCount: { increment: 1 } }
          : { unhelpfulCount: { increment: 1 } },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          publishedBy: { select: { id: true, fullName: true } },
        },
      });

      return this.mapRecord(updated);
    });
  }

  async recordDeflection(idOrSlug: string, userId?: string): Promise<KnowledgeArticle> {
    const article = await this.findByIdOrSlug(idOrSlug);

    if (typeof this.prisma?.articleDeflection?.create === 'function') {
      await this.prisma.articleDeflection.create({
        data: {
          articleId: article.id,
          userId: userId || null,
        },
      });
    }

    if (typeof this.prisma?.knowledgeArticle?.update === 'function') {
      const updated = await this.prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: {
          deflectionCount: { increment: 1 },
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          publishedBy: { select: { id: true, fullName: true } },
        },
      });
      return this.mapRecord(updated);
    }

    article.deflectionCount += 1;
    article.updatedAt = new Date().toISOString();
    return article;
  }

  async getStats(): Promise<KnowledgeBaseStats> {
    if (typeof this.prisma?.knowledgeArticle?.count !== 'function') {
      return {
        totalArticles: 0,
        technicalArticles: 0,
        generalArticles: 0,
        totalHelpfulVotes: 0,
        totalDeflections: 0,
      };
    }

    const [totalArticles, technicalArticles, generalArticles, aggregates] = await Promise.all([
      this.prisma.knowledgeArticle.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.knowledgeArticle.count({
        where: { status: 'PUBLISHED', department: 'TECHNICAL_SUPPORT' },
      }),
      this.prisma.knowledgeArticle.count({
        where: { status: 'PUBLISHED', department: 'GENERAL' },
      }),
      this.prisma.knowledgeArticle.aggregate({
        _sum: {
          helpfulCount: true,
          deflectionCount: true,
        },
        where: { status: 'PUBLISHED' },
      }),
    ]);

    return {
      totalArticles,
      technicalArticles,
      generalArticles,
      totalHelpfulVotes: aggregates._sum.helpfulCount || 0,
      totalDeflections: aggregates._sum.deflectionCount || 0,
    };
  }

  private mapRecord(record: any): KnowledgeArticle {
    return {
      id: record.id,
      slug: record.slug,
      title: record.title,
      department: record.department,
      summary: record.summary,
      body: record.body || record.summary,
      steps: record.steps || [],
      tags: record.tags || [],
      keywords: record.keywords || [],
      status: record.status,
      authorId: record.authorId,
      authorName: record.author?.fullName || 'Staff Member',
      publishedById: record.publishedById,
      publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
      helpfulCount: record.helpfulCount,
      unhelpfulCount: record.unhelpfulCount,
      deflectionCount: record.deflectionCount,
      readTime: `${Math.max(1, Math.ceil((record.steps?.length || 1) * 0.5 + 1))} min read`,
      createdAt: record.createdAt ? record.createdAt.toISOString() : undefined,
      updatedAt: record.updatedAt ? record.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
