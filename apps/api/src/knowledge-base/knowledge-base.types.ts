export interface KnowledgeArticle {
  id: string;
  slug: string;
  title: string;
  department: 'TECHNICAL_SUPPORT' | 'GENERAL';
  category: string;
  summary: string;
  readTime: string;
  tags: string[];
  steps: string[];
  keywords: string[];
  helpfulCount: number;
  unhelpfulCount: number;
  deflectionCount: number;
  updatedAt: string;
}

export interface KnowledgeBaseStats {
  totalArticles: number;
  technicalArticles: number;
  generalArticles: number;
  totalHelpfulVotes: number;
  totalDeflections: number;
}
