"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ui/card";
import { Input } from "@ui/input";
import { Textarea } from "@ui/textarea";
import { Label } from "@ui/label";
import { Badge } from "@ui/badge";
import { ContextualLoader } from "@ui/contextual-loader";
import { ticketsControllerCreate } from "../../api/endpoints/tickets/tickets";
import {
  getStoredSession,
  formatShortTicketId,
  extractApiErrorMessage,
  compressAndEncryptImageFile,
  formatByteSize,
  EncryptedAttachmentPayload,
} from "@lib/helpers";
import { useAuthStore } from "@store/auth.store";
import { useTicketsStore } from "@store/tickets.store";
import { usePortalStore } from "@store/portal.store";
import {
  KNOWLEDGE_BASE_ARTICLES,
  searchKnowledgeBaseArticles,
  recordArticleDeflection,
  KnowledgeArticle,
} from "@lib/knowledge-base";
import { useState, useRef, useEffect, useMemo, ChangeEvent } from "react";

const ticketSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Title must be at least 5 characters long" })
    .max(100, { message: "Title cannot exceed 100 characters" }),
  description: z.string().min(10, {
    message: "Please provide a detailed description (at least 10 characters)",
  }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  department: z.enum(["TECHNICAL_SUPPORT", "GENERAL"]),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

export function TicketForm({ creatorId }: { creatorId?: string }) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [encryptedAttachment, setEncryptedAttachment] =
    useState<EncryptedAttachmentPayload | null>(null);
  const [isEncryptingImage, setIsEncryptingImage] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { upsertTicket } = useTicketsStore();
  const { prefillDraft, clearPrefillDraft, recordDeflection } =
    usePortalStore();

  const [dismissedSuggestionId, setDismissedSuggestionId] = useState<
    string | null
  >(null);
  const [showSuggestionSteps, setShowSuggestionSteps] = useState(false);
  const [deflectionNotice, setDeflectionNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      department: "TECHNICAL_SUPPORT",
    },
  });

  const watchedTitle = watch("title") || "";
  const watchedDepartment = watch("department") || "TECHNICAL_SUPPORT";

  // Handle prefill from Knowledge Base article "Still stuck? Open ticket on this topic"
  useEffect(() => {
    if (prefillDraft) {
      setValue("title", prefillDraft.title, { shouldValidate: true });
      setValue("department", prefillDraft.department, { shouldValidate: true });
      clearPrefillDraft();
    }
  }, [prefillDraft, setValue, clearPrefillDraft]);

  // Real-time deflection suggestion matching
  const suggestedArticle = useMemo(() => {
    if (watchedTitle.trim().length < 3) return null;
    const matches = searchKnowledgeBaseArticles(
      KNOWLEDGE_BASE_ARTICLES,
      watchedTitle,
      watchedDepartment,
    );
    if (matches.length > 0 && matches[0].score >= 8) {
      if (matches[0].article.id === dismissedSuggestionId) return null;
      return matches[0].article;
    }
    return null;
  }, [watchedTitle, watchedDepartment, dismissedSuggestionId]);

  const handleSolveIssue = async (article: KnowledgeArticle) => {
    recordDeflection(article.title);
    try {
      await recordArticleDeflection(article.id);
    } catch {
      // Offline fallback
    }
    reset();
    clearAttachment();
    setDismissedSuggestionId(null);
    setShowSuggestionSteps(false);
    setDeflectionNotice(
      `Resolved via "${article.title}". Ticket draft safely cleared without waiting in the queue!`,
    );
    setTimeout(() => setDeflectionNotice(null), 8000);
  };

  const handleDismissSuggestion = (articleId: string) => {
    setDismissedSuggestionId(articleId);
    setShowSuggestionSteps(false);
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAttachmentError(null);
    if (!file) {
      setEncryptedAttachment(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAttachmentError(
        "Please select a valid image file (PNG, JPG, WebP, GIF).",
      );
      return;
    }

    setIsEncryptingImage(true);
    try {
      const payload = await compressAndEncryptImageFile(file);
      setEncryptedAttachment(payload);
    } catch {
      setAttachmentError("Could not attach the selected image.");
      setEncryptedAttachment(null);
    } finally {
      setIsEncryptingImage(false);
    }
  };

  const clearAttachment = () => {
    setEncryptedAttachment(null);
    setAttachmentError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const session = getStoredSession();
      const activeCreatorId = creatorId || user?.id || session?.user?.id;
      const response = (await ticketsControllerCreate({
        ...values,
        ...(activeCreatorId ? { creatorId: activeCreatorId } : {}),
        ...(encryptedAttachment
          ? { encryptedAttachment: encryptedAttachment as any }
          : {}),
      } as any)) as any;
      return response;
    },
    onSuccess: (data) => {
      upsertTicket(data);
      setSuccessMessage(
        `Ticket ${formatShortTicketId(data.id)} created successfully!`,
      );
      reset();
      clearAttachment();
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const onSubmit = (data: TicketFormValues) => {
    createTicketMutation.mutate(data);
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Submit Support Ticket</CardTitle>
        <CardDescription>
          Fill in details below. Our support engineering team will respond
          shortly.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {createTicketMutation.isPending && (
            <ContextualLoader context="ticket-submission" />
          )}

          {successMessage && (
            <div className="p-3 text-sm rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
              {successMessage}
            </div>
          )}

          {deflectionNotice && (
            <div className="p-3 text-xs sm:text-sm rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-100 dark:border-emerald-800 border-l-4 border-l-emerald-600 dark:border-l-emerald-400">
              <div className="flex items-center gap-2">
                <span className="font-bold">🎉 Self-Service Resolved:</span>
                <span>{deflectionNotice}</span>
              </div>
            </div>
          )}

          {createTicketMutation.isError && (
            <div className="p-3 text-sm rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              {extractApiErrorMessage(
                createTicketMutation.error,
                "Unable to submit your ticket right now. Please try again shortly.",
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="title">Ticket Subject / Title</Label>
            <Input
              id="title"
              placeholder="e.g. Inability to generate billing invoice report"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-red-500 font-medium">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Smart Ticket Deflection Engine - Instant Knowledge Base Resolution */}
          {suggestedArticle && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 p-3 sm:p-4 space-y-2.5 border-l-4 border-l-amber-600 dark:border-l-amber-400 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      💡 Proactive Solution Available
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-bold">
                      Instant Help
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-spruce-950 dark:text-amber-100">
                    {suggestedArticle.title}
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200/90">
                    {suggestedArticle.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissSuggestion(suggestedArticle.id)}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-950 dark:hover:text-white px-1 font-bold"
                  aria-label="Dismiss suggestion"
                  title="Dismiss this suggestion"
                >
                  ✕
                </button>
              </div>

              {/* Collapsible Steps Preview */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowSuggestionSteps((prev) => !prev)}
                  className="text-xs font-semibold text-spruce-800 dark:text-spruce-200 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    {showSuggestionSteps
                      ? "Hide resolution steps"
                      : "View instant fix steps"}
                  </span>
                  <span className="text-[10px]">
                    {showSuggestionSteps ? "▲" : "▼"}
                  </span>
                </button>

                {showSuggestionSteps && (
                  <ol className="mt-2.5 space-y-2 text-xs bg-white/90 dark:bg-spruce-900/90 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60 shadow-xs">
                    {suggestedArticle.steps.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-spruce-900 dark:text-spruce-100 leading-relaxed"
                      >
                        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80">
                          {idx + 1}
                        </span>
                        <span className="flex-1 pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Deflection Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/70 dark:border-amber-800/60">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => handleSolveIssue(suggestedArticle)}
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
                >
                  ✓ This Solved My Problem
                </Button>
                <button
                  type="button"
                  onClick={() => handleDismissSuggestion(suggestedArticle.id)}
                  className="text-[11px] font-medium text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  Continue submitting ticket
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="department">Support Department</Label>
              <select
                id="department"
                defaultValue="TECHNICAL_SUPPORT"
                {...register("department")}
                className="flex h-10 w-full rounded-lg border border-spruce-300/90 bg-white dark:bg-spruce-950/70 px-3 py-2 text-xs sm:text-sm text-spruce-950 dark:text-spruce-100 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spruce-500/20 dark:border-spruce-700/80 dark:focus-visible:ring-spruce-300/30 dark:focus-visible:border-spruce-300 cursor-pointer"
              >
                <option value="TECHNICAL_SUPPORT">Technical Support</option>
                <option value="GENERAL">General Inquiries</option>
              </select>
              {errors.department && (
                <p className="text-xs text-red-500 font-medium">
                  {errors.department.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority Level</Label>
              <select
                id="priority"
                defaultValue="MEDIUM"
                {...register("priority")}
                className="flex h-10 w-full rounded-lg border border-spruce-300/90 bg-white dark:bg-spruce-950/70 px-3 py-2 text-xs sm:text-sm text-spruce-950 dark:text-spruce-100 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spruce-500/20 dark:border-spruce-700/80 dark:focus-visible:ring-spruce-300/30 dark:focus-visible:border-spruce-300 cursor-pointer"
              >
                <option value="LOW">Low (Query / Request)</option>
                <option value="MEDIUM">Medium (Normal)</option>
                <option value="HIGH">High (Degraded)</option>
                <option value="URGENT">Urgent (Outage)</option>
              </select>
              {errors.priority && (
                <p className="text-xs text-red-500 font-medium">
                  {errors.priority.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Provide step-by-step reproduction details, expected results, and actual behavior..."
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-500 font-medium">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Optional Image Attachment (Encrypted In-Transit + Brotli Compressed at Rest) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="attachment">
                Screenshot / Image Attachment (Optional)
              </Label>
            </div>
            <Input
              ref={fileInputRef}
              id="attachment"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="cursor-pointer text-xs file:mr-3 file:rounded file:border-0 file:bg-spruce-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-spruce-900 dark:file:bg-spruce-800 dark:file:text-spruce-200"
            />
            {isEncryptingImage && (
              <p className="text-xs text-spruce-600 dark:text-spruce-300 animate-pulse">
                Preparing attachment...
              </p>
            )}
            {attachmentError && (
              <p className="text-xs text-red-500 font-medium">
                {attachmentError}
              </p>
            )}
            {encryptedAttachment && !isEncryptingImage && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium truncate text-spruce-950 dark:text-spruce-200">
                    {encryptedAttachment.fileName}
                  </span>
                  <span className="text-spruce-500 dark:text-spruce-400 shrink-0">
                    ({formatByteSize(encryptedAttachment.originalSize)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="text-red-500 hover:underline shrink-0 text-[11px]"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              clearAttachment();
            }}
            disabled={createTicketMutation.isPending || isEncryptingImage}
          >
            Clear
          </Button>
          <Button
            type="submit"
            disabled={createTicketMutation.isPending || isEncryptingImage}
          >
            {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
