export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  department: 'TECHNICAL_SUPPORT' | 'GENERAL';
  category?: string;
  summary: string;
  body?: string;
  readTime?: string;
  tags: string[];
  steps: string[];
  keywords: string[];
  status?: ArticleStatus;
  authorId?: string;
  authorName?: string;
  publishedById?: string | null;
  publishedAt?: string | null;
  helpfulCount: number;
  unhelpfulCount: number;
  deflectionCount: number;
  createdAt?: string;
  updatedAt: string;
}

export interface KnowledgeBaseStats {
  totalArticles: number;
  technicalArticles: number;
  generalArticles: number;
  totalHelpfulVotes: number;
  totalDeflections: number;
}

export class CreateArticleDto {
  title!: string;
  summary!: string;
  body?: string;
  steps?: string[];
  department!: 'TECHNICAL_SUPPORT' | 'GENERAL';
  category?: string;
  tags?: string[];
  keywords?: string[];
}

export class UpdateArticleDto {
  title?: string;
  summary?: string;
  body?: string;
  steps?: string[];
  department?: 'TECHNICAL_SUPPORT' | 'GENERAL';
  category?: string;
  tags?: string[];
  keywords?: string[];
}

export class ArticleFeedbackDto {
  helpful!: boolean;
}
