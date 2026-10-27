'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client';
import { Button } from '@ui/button';
import { extractApiErrorMessage } from '@lib/helpers';

interface CsatRatingWidgetProps {
  ticketId: string;
  initialRating?: number | null;
  initialComment?: string | null;
  ratedAt?: string | null;
  onRated?: () => void;
}

const RATING_DESCRIPTIONS: Record<number, string> = {
  1: 'Very Dissatisfied (1/5)',
  2: 'Dissatisfied (2/5)',
  3: 'Neutral (3/5)',
  4: 'Satisfied (4/5)',
  5: 'Exceptional (5/5)',
};

export function CsatRatingWidget({
  ticketId,
  initialRating,
  initialComment,
  ratedAt,
  onRated,
}: CsatRatingWidgetProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = React.useState<number>(initialRating || 0);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>(initialComment || '');
  const [isEditing, setIsEditing] = React.useState<boolean>(!initialRating);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const csatMutation = useMutation({
    mutationFn: async (payload: { rating: number; comment?: string }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/csat`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsEditing(false);
      setErrorMessage(null);
      if (onRated) {
        onRated();
      }
    },
    onError: (err) => {
      setErrorMessage(
        extractApiErrorMessage(err, 'Failed to submit satisfaction feedback'),
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMessage('Please select a rating between 1 and 5 stars');
      return;
    }
    setErrorMessage(null);
    csatMutation.mutate({
      rating,
      comment: comment.trim() || undefined,
    });
  };

  const activeStar = hoverRating || rating;

  if (!isEditing && initialRating) {
    return (
      <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-amber-500">
              Customer Satisfaction Feedback
            </span>
            <div className="flex items-center text-amber-400 text-sm">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={star <= initialRating ? 'opacity-100' : 'opacity-25'}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-300">
              ({initialRating}/5)
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-7 text-xs text-slate-400 hover:text-white"
          >
            Edit Feedback
          </Button>
        </div>

        {initialComment && (
          <p className="text-xs text-slate-300 italic bg-slate-900/40 p-2.5 rounded border border-slate-800">
            &ldquo;{initialComment}&rdquo;
          </p>
        )}

        {ratedAt && (
          <div className="text-[10px] text-slate-500">
            Feedback recorded on {new Date(ratedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-slate-900/60 to-slate-900/90 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>⭐ How satisfied are you with this resolution?</span>
          </h4>
          <p className="text-xs text-slate-400">
            Your feedback directly helps our support team improve response quality.
          </p>
        </div>
        {initialRating && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Star Selection Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= activeStar;
              return (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} Star`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="p-1 focus:outline-none text-2xl transition-transform hover:scale-125 duration-100"
                >
                  <span
                    className={
                      isFilled
                        ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                        : 'text-slate-600 hover:text-slate-400'
                    }
                  >
                    ★
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-xs font-semibold text-slate-300 ml-2">
            {activeStar > 0 ? RATING_DESCRIPTIONS[activeStar] : 'Select rating'}
          </span>
        </div>

        {/* Optional Comment Input */}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what went well or what could be improved... (optional)"
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {errorMessage && (
          <div className="text-xs text-red-400 font-medium">{errorMessage}</div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={rating === 0 || csatMutation.isPending}
            className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
          >
            {csatMutation.isPending ? 'Submitting...' : 'Submit Satisfaction Rating'}
          </Button>
        </div>
      </form>
    </div>
  );
}
