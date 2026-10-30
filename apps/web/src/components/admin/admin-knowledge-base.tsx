"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent } from "@ui/card";
import { Input } from "@ui/input";
import { Button } from "@ui/button";
import {
  KnowledgeArticle,
  fetchKnowledgeBaseArticles,
  fetchKnowledgeBaseStats,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  publishKnowledgeArticle,
  archiveKnowledgeArticle,
  deleteKnowledgeArticle,
  CreateKnowledgeArticleInput,
} from "@lib/knowledge-base";
import { AuthUser, extractApiErrorMessage } from "@lib/helpers";
import { ChangeEvent, FormEvent, useState } from "react";
import { DraftGuideModal } from "@components/portal/draft-guide-modal";

interface AdminKnowledgeBaseProps {
  user: AuthUser | null;
}

export function AdminKnowledgeBase({ user }: AdminKnowledgeBaseProps) {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(
    null,
  );
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("write");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [department, setDepartment] = useState<"TECHNICAL_SUPPORT" | "GENERAL">(
    "TECHNICAL_SUPPORT",
  );
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);

  const { data: stats } = useQuery({
    queryKey: ["kb-stats"],
    queryFn: fetchKnowledgeBaseStats,
    staleTime: 30 * 1000,
  });

  const {
    data: articles = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "kb-admin-articles",
      statusFilter,
      departmentFilter,
      searchQuery,
    ],
    queryFn: () =>
      fetchKnowledgeBaseArticles({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        department: departmentFilter !== "ALL" ? departmentFilter : undefined,
        search: searchQuery.trim() || undefined,
      }),
    staleTime: 10 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createKnowledgeArticle,
    onSuccess: (newArticle) => {
      queryClient.invalidateQueries({ queryKey: ["kb-admin-articles"] });
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
      closeEditor();
      showSuccess(`Draft guide "${newArticle.title}" created successfully.`);
    },
    onError: (err) => {
      setActionError(extractApiErrorMessage(err, "Failed to create article."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreateKnowledgeArticleInput>;
    }) => updateKnowledgeArticle(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["kb-admin-articles"] });
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
      closeEditor();
      showSuccess(`Article "${updated.title}" updated.`);
    },
    onError: (err) => {
      setActionError(extractApiErrorMessage(err, "Failed to update article."));
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishKnowledgeArticle,
    onSuccess: (published) => {
      queryClient.invalidateQueries({ queryKey: ["kb-admin-articles"] });
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
      showSuccess(`Article "${published.title}" published to Customer Portal.`);
    },
    onError: (err) => {
      setActionError(extractApiErrorMessage(err, "Failed to publish article."));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: archiveKnowledgeArticle,
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ["kb-admin-articles"] });
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
      showSuccess(`Article "${archived.title}" archived.`);
    },
    onError: (err) => {
      setActionError(extractApiErrorMessage(err, "Failed to archive article."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKnowledgeArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-admin-articles"] });
      queryClient.invalidateQueries({ queryKey: ["kb-stats"] });
      showSuccess("Article deleted permanently.");
    },
    onError: (err) => {
      setActionError(extractApiErrorMessage(err, "Failed to delete article."));
    },
  });

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setActionError(null);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const openCreateComposer = () => {
    setEditingArticle(null);
    setTitle("");
    setSummary("");
    setBody("");
    setDepartment("TECHNICAL_SUPPORT");
    setCategory("Network & Connectivity");
    setTagsInput("");
    setKeywordsInput("");
    setSteps([""]);
    setBodyMode("write");
    setActionError(null);
    setIsComposerOpen(true);
  };

  const openEditComposer = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setTitle(article.title);
    setSummary(article.summary);
    setBody(article.body || "");
    setDepartment(article.department);
    setCategory(article.category || "General");
    setTagsInput(article.tags?.join(", ") || "");
    setKeywordsInput(article.keywords?.join(", ") || "");
    setSteps(article.steps && article.steps.length > 0 ? article.steps : [""]);
    setBodyMode("write");
    setActionError(null);
    setIsComposerOpen(true);
  };

  const closeEditor = () => {
    setIsComposerOpen(false);
    setEditingArticle(null);
    setActionError(null);
  };

  const handleStepChange = (index: number, val: string) => {
    const updated = [...steps];
    updated[index] = val;
    setSteps(updated);
  };

  const addStep = () => {
    setSteps([...steps, ""]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, idx) => idx !== index));
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      setActionError("Title and Summary are required fields.");
      return;
    }

    const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean);
    const cleanedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const cleanedKeywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const payload: CreateKnowledgeArticleInput = {
      title: title.trim(),
      summary: summary.trim(),
      body: body.trim() || undefined,
      department,
      category: category.trim() || undefined,
      steps: cleanedSteps.length > 0 ? cleanedSteps : undefined,
      tags: cleanedTags.length > 0 ? cleanedTags : undefined,
      keywords: cleanedKeywords.length > 0 ? cleanedKeywords : undefined,
    };

    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800">
          <p className="text-[11px] font-semibold text-spruce-500 uppercase">
            Total Articles
          </p>
          <p className="text-xl font-black text-spruce-900 dark:text-white mt-0.5">
            {stats?.totalArticles ?? articles.length}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800">
          <p className="text-[11px] font-semibold text-spruce-500 uppercase">
            Technical
          </p>
          <p className="text-xl font-black text-spruce-700 dark:text-spruce-300 mt-0.5">
            {stats?.technicalArticles ?? 0}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800">
          <p className="text-[11px] font-semibold text-spruce-500 uppercase">
            General
          </p>
          <p className="text-xl font-black text-teal-700 dark:text-teal-300 mt-0.5">
            {stats?.generalArticles ?? 0}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800">
          <p className="text-[11px] font-semibold text-spruce-500 uppercase">
            Helpful Votes
          </p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {stats?.totalHelpfulVotes ?? 0}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold text-spruce-500 uppercase">
            Deflections
          </p>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
            {stats?.totalDeflections ?? 0}
          </p>
        </Card>
      </div>

      {/* Notices */}
      {successNotice && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 font-medium">
          ✓ {successNotice}
        </div>
      )}
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 font-medium">
          ✕ {actionError}
        </div>
      )}

      {/* Controls & Search */}
      <Card className="border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* Status pills */}
            {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-spruce-800 text-white dark:bg-spruce-100 dark:text-spruce-950 shadow-xs"
                    : "bg-spruce-100 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300 hover:bg-spruce-200 dark:hover:bg-spruce-700"
                }`}
              >
                {st === "ALL"
                  ? "All Status"
                  : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800 text-spruce-800 dark:text-spruce-200"
            >
              <option value="ALL">All Scopes</option>
              <option value="TECHNICAL_SUPPORT">Technical Support</option>
              <option value="GENERAL">General Scope</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Filter by keyword..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              className="text-xs h-9 w-full md:w-56"
            />
            <Button
              type="button"
              onClick={openCreateComposer}
              className="h-9 text-xs font-bold shrink-0 bg-spruce-800 text-white hover:bg-spruce-900 dark:bg-spruce-100 dark:text-spruce-950 dark:hover:bg-white"
            >
              + New Article
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Editor Modal / Drawer */}
      <DraftGuideModal
        isOpen={isComposerOpen}
        onClose={closeEditor}
        editingArticle={editingArticle}
        isAdmin={isAdmin}
        onSuccess={() => {
          closeEditor();
          refetch();
        }}
      />

      {/* Articles List Table / Card View */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-spruce-500">
          Loading knowledge base articles...
        </div>
      ) : articles.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-2 border-spruce-200 dark:border-spruce-800">
          <p className="text-sm font-semibold text-spruce-700 dark:text-spruce-300">
            No articles match the selected filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateComposer}
            className="mt-3 text-xs"
          >
            Create First Guide
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((art) => {
            const status = art.status || "PUBLISHED";
            return (
              <div
                key={art.id}
                className="bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:shadow-xs transition-shadow"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : status === "DRAFT"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {status}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        art.department === "TECHNICAL_SUPPORT"
                          ? "bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200"
                          : "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200"
                      }`}
                    >
                      {art.department === "TECHNICAL_SUPPORT"
                        ? "Technical Support"
                        : "General"}
                    </span>
                    {art.category && (
                      <span className="text-[11px] text-spruce-500 dark:text-spruce-400">
                        • {art.category}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-spruce-950 dark:text-white truncate">
                    {art.title}
                  </h3>
                  <p className="text-xs text-spruce-600 dark:text-spruce-300 line-clamp-2">
                    {art.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-spruce-500 dark:text-spruce-400">
                    <span>
                      Deflections:{" "}
                      <strong className="text-spruce-800 dark:text-spruce-200">
                        {art.deflectionCount ?? 0}
                      </strong>
                    </span>
                    <span>
                      Helpful:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-300">
                        👍 {art.helpfulCount ?? 0}
                      </strong>
                    </span>
                    <span>
                      Unhelpful:{" "}
                      <strong className="text-red-600 dark:text-red-400">
                        👎 {art.unhelpfulCount ?? 0}
                      </strong>
                    </span>
                    {art.authorName && <span>Author: {art.authorName}</span>}
                  </div>
                </div>

                {/* Staff / Admin Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-start md:self-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditComposer(art)}
                    className="h-8 text-xs"
                  >
                    Edit
                  </Button>

                  {isAdmin && (
                    <>
                      {status !== "PUBLISHED" && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={publishMutation.isPending}
                          onClick={() => publishMutation.mutate(art.id)}
                          className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                        >
                          Publish
                        </Button>
                      )}

                      {status === "PUBLISHED" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={archiveMutation.isPending}
                          onClick={() => archiveMutation.mutate(art.id)}
                          className="h-8 text-xs text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                        >
                          Archive
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${art.title}" permanently?`,
                            )
                          ) {
                            deleteMutation.mutate(art.id);
                          }
                        }}
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
