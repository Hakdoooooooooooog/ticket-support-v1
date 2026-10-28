import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeArticle, KnowledgeBaseStats } from './knowledge-base.types.js';
import { INITIAL_KNOWLEDGE_ARTICLES } from './knowledge-base.data.js';

@Injectable()
export class KnowledgeBaseService {
  private articles: KnowledgeArticle[] = JSON.parse(JSON.stringify(INITIAL_KNOWLEDGE_ARTICLES));

  async findAll(query?: string, department?: string): Promise<KnowledgeArticle[]> {
    let result = [...this.articles];

    if (department && department !== 'ALL') {
      result = result.filter((a) => a.department === department);
    }

    if (query && query.trim().length > 0) {
      const tokens = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      if (tokens.length > 0) {
        const scored = result.map((article) => {
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

        result = scored
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.article);
      }
    }

    return result;
  }

  async findByIdOrSlug(idOrSlug: string): Promise<KnowledgeArticle> {
    const article = this.articles.find(
      (a) => a.id === idOrSlug || a.slug === idOrSlug,
    );
    if (!article) {
      throw new NotFoundException(`Knowledge base article '${idOrSlug}' not found.`);
    }
    return article;
  }

  async recordFeedback(idOrSlug: string, helpful: boolean): Promise<KnowledgeArticle> {
    const article = await this.findByIdOrSlug(idOrSlug);
    if (helpful) {
      article.helpfulCount += 1;
    } else {
      article.unhelpfulCount += 1;
    }
    article.updatedAt = new Date().toISOString();
    return article;
  }

  async recordDeflection(idOrSlug: string): Promise<KnowledgeArticle> {
    const article = await this.findByIdOrSlug(idOrSlug);
    article.deflectionCount += 1;
    article.updatedAt = new Date().toISOString();
    return article;
  }

  async getStats(): Promise<KnowledgeBaseStats> {
    const totalArticles = this.articles.length;
    const technicalArticles = this.articles.filter((a) => a.department === 'TECHNICAL_SUPPORT').length;
    const generalArticles = this.articles.filter((a) => a.department === 'GENERAL').length;
    const totalHelpfulVotes = this.articles.reduce((acc, curr) => acc + curr.helpfulCount, 0);
    const totalDeflections = this.articles.reduce((acc, curr) => acc + curr.deflectionCount, 0);

    return {
      totalArticles,
      technicalArticles,
      generalArticles,
      totalHelpfulVotes,
      totalDeflections,
    };
  }
}
