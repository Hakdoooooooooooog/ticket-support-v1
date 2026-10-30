"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsControllerSubmitCsat } from "../api/endpoints/tickets/tickets";
import { Button } from "@ui/button";
import { extractApiErrorMessage } from "@lib/helpers";
import { useState, FormEvent } from "react";

interface CsatRatingWidgetProps {
  ticketId: string;
  creatorId?: string | null;
  creatorName?: string | null;
  currentUserId?: string;
  currentUserRole?: string;
  initialRating?: number | null;
  initialComment?: string | null;
  ratedAt?: string | null;
  onRated?: () => void;
}

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: "1/5 · Very Dissatisfied",
  2: "2/5 · Dissatisfied",
  3: "3/5 · Neutral",
  4: "4/5 · Satisfied",
  5: "5/5 · Exceptional Resolution",
};

const RATING_COLORS: Record<number, string> = {
  1: "bg-rose-600 text-white border-rose-500 shadow-rose-900/40",
  2: "bg-orange-600 text-white border-orange-500 shadow-orange-900/40",
  3: "bg-amber-500 text-spruce-950 border-amber-400 shadow-amber-900/40 font-bold",
  4: "bg-sky-600 text-white border-sky-500 shadow-sky-900/40 font-bold",
  5: "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/40 font-bold",
};

export function CsatRatingWidget({
  ticketId,
  creatorId,
  creatorName,
  currentUserId,
  currentUserRole,
  initialRating,
  initialComment,
  ratedAt,
  onRated,
}: CsatRatingWidgetProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number>(initialRating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(initialComment || "");
  const [isEditing, setIsEditing] = useState<boolean>(!initialRating);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security & Authorization Guard:
  // Only the original customer who reported the ticket may submit or modify CSAT ratings.
  // Support engineers and administrators must never be able to rate tickets they worked on.
  const isTicketReporter =
    currentUserRole === "CUSTOMER" &&
    Boolean(currentUserId) &&
    Boolean(creatorId) &&
    currentUserId === creatorId;

  const csatMutation = useMutation({
    mutationFn: async (payload: { rating: number; comment?: string }) => {
      const res = (await ticketsControllerSubmitCsat(
        ticketId,
        payload as any,
      )) as any;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setIsEditing(false);
      setErrorMessage(null);
      if (onRated) {
        onRated();
      }
    },
    onError: (err) => {
      setErrorMessage(
        extractApiErrorMessage(err, "Failed to submit satisfaction feedback"),
      );
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isTicketReporter) {
      setErrorMessage(
        "Only the customer who reported this ticket can submit satisfaction feedback.",
      );
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage("Please select a rating between 1 and 5");
      return;
    }
    setErrorMessage(null);
    csatMutation.mutate({
      rating,
      comment: comment.trim() || undefined,
    });
  };

  const activeStar = hoverRating || rating;

  // Case 1: Non-reporter viewing a ticket that has not been rated yet
  if (!isTicketReporter && !initialRating) {
    return (
      <div className="p-3.5 rounded-lg border border-spruce-200 dark:border-spruce-700/60 bg-spruce-50/80 dark:bg-spruce-900/50 text-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
            CSAT PENDING
          </span>
          <span className="text-spruce-600 dark:text-spruce-300 text-xs">
            {currentUserRole === "AGENT" || currentUserRole === "ADMIN"
              ? "Awaiting customer rating. Support engineers cannot rate tickets."
              : `Awaiting feedback from ${creatorName || "the reporting customer"}.`}
          </span>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-spruce-200 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-200 whitespace-nowrap">
          Customer Only
        </span>
      </div>
    );
  }

  // Case 2: Ticket already has customer feedback (read-only for non-reporters, editable for reporter)
  if (!isEditing && initialRating) {
    return (
      <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/30 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700/60">
              CSAT SCORE {initialRating}.0 / 5.0
            </span>
            <span className="text-xs font-semibold text-spruce-800 dark:text-spruce-200">
              {RATING_DESCRIPTIONS[initialRating] || `${initialRating}/5`}
            </span>
          </div>

          {isTicketReporter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
            >
              Edit Feedback
            </Button>
          )}
        </div>

        {initialComment && (
          <p className="text-xs text-spruce-900 dark:text-spruce-100 italic bg-white dark:bg-spruce-900/60 p-2.5 rounded border border-amber-200/80 dark:border-spruce-800">
            &ldquo;{initialComment}&rdquo;
          </p>
        )}

        {ratedAt && (
          <div className="text-[10px] text-spruce-500 dark:text-spruce-400">
            Feedback recorded on {new Date(ratedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-spruce-200 dark:border-spruce-700/60 bg-white dark:bg-spruce-900/90 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-spruce-600 dark:text-spruce-300">
            Customer Satisfaction Rating
          </div>
          <h4 className="text-sm font-bold text-spruce-950 dark:text-white">
            How satisfied are you with this resolution?
          </h4>
          <p className="text-xs text-spruce-600 dark:text-spruce-300/90">
            Your feedback directly impacts support response benchmarks and
            quality SLA.
          </p>
        </div>
        {initialRating && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs font-medium text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Numbered Score Selection Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1.5"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((num) => {
              const isSelectedOrHovered =
                num === activeStar || (!hoverRating && num === rating);
              return (
                <button
                  key={num}
                  type="button"
                  aria-label={`Score ${num}`}
                  onClick={() => setRating(num)}
                  onMouseEnter={() => setHoverRating(num)}
                  className={`h-9 w-9 rounded-lg border text-sm font-extrabold transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 cursor-pointer ${
                    isSelectedOrHovered
                      ? `${RATING_COLORS[num]} scale-105 shadow-md`
                      : "border-spruce-300 dark:border-spruce-700 bg-spruce-50 dark:bg-spruce-950/80 text-spruce-700 dark:text-spruce-400 hover:border-spruce-400 dark:hover:border-spruce-500 hover:text-spruce-950 dark:hover:text-white"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-semibold text-spruce-800 dark:text-spruce-200">
            {activeStar > 0
              ? RATING_DESCRIPTIONS[activeStar]
              : "Select rating (1 to 5)"}
          </span>
        </div>

        {/* Optional Comment Input */}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what went well or what could be improved... (optional)"
            rows={2}
            className="w-full rounded-md border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-950/90 px-3 py-2 text-xs text-spruce-950 dark:text-spruce-100 placeholder:text-spruce-400 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:focus:ring-spruce-400"
          />
        </div>

        {errorMessage && (
          <div className="text-xs text-red-500 font-medium">{errorMessage}</div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={rating === 0 || csatMutation.isPending}
            className="h-8 px-4 text-xs font-semibold"
          >
            {csatMutation.isPending
              ? "Submitting..."
              : "Submit Satisfaction Rating"}
          </Button>
        </div>
      </form>
    </div>
  );
}
