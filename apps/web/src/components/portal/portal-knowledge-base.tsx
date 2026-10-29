'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ui/card';
import { Input } from '@ui/input';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import {
  KNOWLEDGE_BASE_ARTICLES,
  searchKnowledgeBaseArticles,
  fetchKnowledgeBaseArticles,
  submitArticleFeedback,
  KnowledgeArticle,
} from '@lib/knowledge-base';
import { usePortalStore, PortalDepartmentFilter } from '@store/portal.store';

export function PortalKnowledgeBase() {
  const {
    departmentFilter,
    knowledgeSearchQuery,
    expandedArticleIds,
    feedbackGiven,
    setDepartmentFilter,
    setKnowledgeSearchQuery,
    toggleArticleExpanded,
    rateArticleHelpful,
    prefillTicketFromArticle,
  } = usePortalStore();

  const [copiedArticleId, setCopiedArticleId] = React.useState<string | null>(null);

  const { data: serverArticles } = useQuery({
    queryKey: ['knowledge-base-articles'],
    queryFn: async () => {
      try {
        const list = await fetchKnowledgeBaseArticles();
        return list && list.length > 0 ? list : KNOWLEDGE_BASE_ARTICLES;
      } catch {
        return KNOWLEDGE_BASE_ARTICLES;
      }
    },
    placeholderData: KNOWLEDGE_BASE_ARTICLES,
    staleTime: 60 * 1000,
  });

  const allArticles = serverArticles ?? KNOWLEDGE_BASE_ARTICLES;

  const filteredArticles = React.useMemo(() => {
    let list = allArticles;

    if (departmentFilter !== 'ALL') {
      list = list.filter((a) => a.department === departmentFilter);
    }

    if (knowledgeSearchQuery.trim()) {
      const scored = searchKnowledgeBaseArticles(list, knowledgeSearchQuery, departmentFilter);
      return scored.map((item) => item.article);
    }

    return list;
  }, [allArticles, departmentFilter, knowledgeSearchQuery]);

  const handleCopySteps = async (article: KnowledgeArticle) => {
    const stepsText = article.steps && article.steps.length > 0
      ? `\n\nSteps:\n${article.steps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}`
      : '';
    const bodyText = article.body ? `\n\n${article.body}` : '';
    const text = `${article.title}${bodyText}${stepsText}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedArticleId(article.id);
      setTimeout(() => setCopiedArticleId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleFeedback = async (articleId: string, isHelpful: boolean) => {
    rateArticleHelpful(articleId, isHelpful);
    try {
      await submitArticleFeedback(articleId, isHelpful);
    } catch {
      // Local optimistic feedback preserved in store
    }
  };

  const techCount = React.useMemo(
    () => allArticles.filter((a) => a.department === 'TECHNICAL_SUPPORT').length,
    [allArticles],
  );
  const generalCount = React.useMemo(
    () => allArticles.filter((a) => a.department === 'GENERAL').length,
    [allArticles],
  );

  return (
    <div className="space-y-6">
      {/* Search and Category Filter Header */}
      <Card className="border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/90 shadow-xs">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-spruce-950 dark:text-white">
                Self-Service Knowledge Base & FAQs
              </h2>
              <p className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-300 mt-0.5">
                Instant troubleshooting guides for technical support inquiries and general IT requests.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Input
                type="text"
                placeholder="Search solutions (e.g. VPN, SSO, Invoice)..."
                value={knowledgeSearchQuery}
                onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
                className="pr-8 text-xs sm:text-sm"
              />
              {knowledgeSearchQuery && (
                <button
                  type="button"
                  onClick={() => setKnowledgeSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-spruce-100 dark:border-spruce-800/80">
            <span className="text-xs font-semibold text-spruce-600 dark:text-spruce-400 mr-1">
              Category:
            </span>
            <button
              type="button"
              onClick={() => setDepartmentFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                departmentFilter === 'ALL'
                  ? 'bg-spruce-800 text-white dark:bg-spruce-200 dark:text-spruce-950 font-bold'
                  : 'bg-spruce-100 text-spruce-700 hover:bg-spruce-200 dark:bg-spruce-800 dark:text-spruce-300 dark:hover:bg-spruce-700'
              }`}
            >
              All Guides ({KNOWLEDGE_BASE_ARTICLES.length})
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter('TECHNICAL_SUPPORT')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                departmentFilter === 'TECHNICAL_SUPPORT'
                  ? 'bg-spruce-800 text-white dark:bg-spruce-200 dark:text-spruce-950 font-bold'
                  : 'bg-spruce-100 text-spruce-700 hover:bg-spruce-200 dark:bg-spruce-800 dark:text-spruce-300 dark:hover:bg-spruce-700'
              }`}
            >
              Technical Support ({techCount})
            </button>
            <button
              type="button"
              onClick={() => setDepartmentFilter('GENERAL')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                departmentFilter === 'GENERAL'
                  ? 'bg-spruce-800 text-white dark:bg-spruce-200 dark:text-spruce-950 font-bold'
                  : 'bg-spruce-100 text-spruce-700 hover:bg-spruce-200 dark:bg-spruce-800 dark:text-spruce-300 dark:hover:bg-spruce-700'
              }`}
            >
              General Scope ({generalCount})
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Articles List */}
      {filteredArticles.length === 0 ? (
        <Card className="p-8 text-center bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800">
          <p className="text-sm font-semibold text-spruce-900 dark:text-spruce-100">
            No matching guides found for &quot;{knowledgeSearchQuery}&quot;
          </p>
          <p className="text-xs text-spruce-600 dark:text-spruce-400 mt-1">
            Try broadening your search term or switch to the tickets tab to file a direct support request.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKnowledgeSearchQuery('')}
            className="mt-4"
          >
            Clear Search Filter
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => {
            const isExpanded = Boolean(expandedArticleIds[article.id]);
            const feedback = feedbackGiven[article.id];

            return (
              <div
                key={article.id}
                className="bg-white dark:bg-spruce-900/90 border border-spruce-200 dark:border-spruce-800 border-l-4 border-l-spruce-700 dark:border-l-spruce-300 rounded-xl overflow-hidden shadow-xs transition-all"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleArticleExpanded(article.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-spruce-50/60 dark:hover:bg-spruce-800/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${
                          article.department === 'TECHNICAL_SUPPORT'
                            ? 'bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200'
                            : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200'
                        }`}
                      >
                        {article.department === 'TECHNICAL_SUPPORT' ? 'Technical Support' : 'General Scope'}
                      </span>
                      <span className="text-[11px] font-mono text-spruce-500 dark:text-spruce-400">
                        {article.readTime}
                      </span>
                      <span className="text-[11px] text-spruce-500 dark:text-spruce-400">
                        • {article.category}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-spruce-950 dark:text-white">
                      {article.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-300">
                      {article.summary}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse guide' : 'Expand guide'}
                      className="text-spruce-500 dark:text-spruce-400 hover:text-spruce-900 dark:hover:text-white p-1"
                    >
                      <span className={`inline-block transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>
                </div>

                {/* Expanded Troubleshooting Steps and Guide Content */}
                {isExpanded && (
                  <div className="border-t border-spruce-100 dark:border-spruce-800 bg-spruce-50/50 dark:bg-spruce-950/40 p-4 sm:p-6 space-y-4">
                    {/* Markdown Body */}
                    {article.body && (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm text-spruce-800 dark:text-spruce-200 border-b border-spruce-200/60 dark:border-spruce-800 pb-3 mb-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {article.body}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Step-by-Step Resolution */}
                    {article.steps && article.steps.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-spruce-800 dark:text-spruce-200">
                          Resolution Steps:
                        </h4>
                        <ol className="space-y-2.5 text-xs sm:text-sm text-spruce-800 dark:text-spruce-200">
                          {article.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                              <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold bg-spruce-200 dark:bg-spruce-800 text-spruce-900 dark:text-spruce-100 border border-spruce-300 dark:border-spruce-700">
                                {idx + 1}
                              </span>
                              <span className="flex-1 pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Actions and Feedback Bar */}
                    <div className="pt-4 border-t border-spruce-200/80 dark:border-spruce-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Left actions: Copy & Prefill */}
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopySteps(article)}
                          className="h-8 text-xs"
                        >
                          {copiedArticleId === article.id ? '✓ Copied to Clipboard' : 'Copy Solution Steps'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => prefillTicketFromArticle(article.title, article.department)}
                          className="h-8 text-xs text-spruce-700 hover:text-spruce-950 dark:text-spruce-300 dark:hover:text-white"
                        >
                          Still stuck? Open ticket on this topic &rarr;
                        </Button>
                      </div>

                      {/* Right feedback: Helpful? */}
                      <div className="flex items-center gap-2">
                        {feedback ? (
                          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                            ✓ Thank you for your feedback!
                          </span>
                        ) : (
                          <>
                            <span className="text-spruce-600 dark:text-spruce-400 text-xs">
                              Was this helpful?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFeedback(article.id, true)}
                              className="px-2 py-1 rounded bg-spruce-100 hover:bg-spruce-200 dark:bg-spruce-800 dark:hover:bg-spruce-700 text-spruce-800 dark:text-spruce-200 text-xs font-medium cursor-pointer"
                            >
                              👍 Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFeedback(article.id, false)}
                              className="px-2 py-1 rounded bg-spruce-100 hover:bg-spruce-200 dark:bg-spruce-800 dark:hover:bg-spruce-700 text-spruce-800 dark:text-spruce-200 text-xs font-medium cursor-pointer"
                            >
                              👎 No
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
