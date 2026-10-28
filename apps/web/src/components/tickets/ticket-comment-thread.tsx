'use client';

import * as React from 'react';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import {
  formatCommentTime,
  formatByteSize,
  parseTimelineComment,
  DecryptedAttachmentResult,
} from '@lib/helpers';
import { TicketComment } from './ticket-types';

export interface TicketCommentThreadProps {
  comments?: TicketComment[];
  ticketId: string;
  isHistoryExpanded: boolean;
  onToggleHistory: (ticketId: string) => void;
  decryptedAttachments: Record<string, DecryptedAttachmentResult>;
  loadingAttachmentKeys: Record<string, boolean>;
  hiddenAttachmentKeys: Record<string, boolean>;
  onToggleAttachmentVisibility: (key: string) => void;
  onInspectImage: (payload: DecryptedAttachmentResult) => void;
}

export function TicketCommentThread({
  comments = [],
  ticketId,
  isHistoryExpanded,
  onToggleHistory,
  decryptedAttachments,
  loadingAttachmentKeys,
  hiddenAttachmentKeys,
  onToggleAttachmentVisibility,
  onInspectImage,
}: TicketCommentThreadProps) {
  if (comments.length === 0) {
    return (
      <p className="text-xs text-spruce-400 italic py-1">
        No follow-up messages or support notes yet.
      </p>
    );
  }

  const hasMultiple = comments.length > 1;
  const earlierComments = hasMultiple ? comments.slice(0, -1) : [];
  const latestComment = comments[comments.length - 1];

  const renderCommentCard = (comment: TicketComment, isLatest = false) => {
    const parsed = parseTimelineComment(comment.content);
    const commentAttachmentKey = `comment:${comment.id}`;
    const decryptedCommentImg = decryptedAttachments[commentAttachmentKey];
    const isLoadingCommentImg = Boolean(loadingAttachmentKeys[commentAttachmentKey]);
    const isCommentImgHidden = Boolean(hiddenAttachmentKeys[commentAttachmentKey]);

    const cardTone =
      parsed.kind === 'FOLLOW_UP'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
        : parsed.kind === 'AMENDMENT'
          ? 'bg-spruce-100/70 dark:bg-spruce-900/60 border-spruce-300 dark:border-spruce-700/80 text-spruce-950 dark:text-spruce-100'
          : 'bg-white dark:bg-spruce-900/40 border-spruce-200/90 dark:border-spruce-800 text-spruce-950 dark:text-spruce-200';

    return (
      <div key={comment.id} className={`p-3 rounded-lg border text-xs space-y-2 ${cardTone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-spruce-900 dark:text-white">
              {comment.author?.fullName || 'Support'}
            </span>
            {comment.author?.role && (
              <span className="text-[11px] text-spruce-600 dark:text-spruce-400 font-normal">
                ({comment.author.role.toLowerCase()})
              </span>
            )}
            {parsed.kind === 'FOLLOW_UP' ? (
              <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                Follow-Up
              </Badge>
            ) : parsed.kind === 'AMENDMENT' ? (
              <Badge variant="default" className="text-[10px] py-0 px-1.5">
                Amendment
              </Badge>
            ) : null}
            {isLatest && hasMultiple && (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 font-semibold border-spruce-300 dark:border-spruce-700 bg-spruce-100/70 dark:bg-spruce-800/60 text-spruce-800 dark:text-spruce-200"
              >
                Latest
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-spruce-500 dark:text-spruce-400">
            {formatCommentTime(comment.createdAt)}
          </span>
        </div>

        <p className="text-spruce-800 dark:text-spruce-200 whitespace-pre-wrap leading-relaxed">
          {parsed.cleanText}
        </p>

        {/* Attachment linked to comment */}
        {comment.hasAttachment && (
          <div className="p-2.5 rounded-md bg-white/80 dark:bg-spruce-950/70 border border-spruce-200/80 dark:border-spruce-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-spruce-800 dark:text-spruce-200">
                  {comment.attachmentName || 'attachment.webp'}
                </span>
                {comment.attachmentOriginalSize && (
                  <span className="text-spruce-500 dark:text-spruce-400">
                    ({formatByteSize(comment.attachmentOriginalSize)})
                  </span>
                )}
              </div>
              {decryptedCommentImg ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleAttachmentVisibility(commentAttachmentKey)}
                  className="h-7 text-xs"
                >
                  {isCommentImgHidden ? 'Show Image' : 'Hide Image'}
                </Button>
              ) : (
                <span className="text-[11px] text-spruce-400">
                  {isLoadingCommentImg ? 'Decrypting image...' : ''}
                </span>
              )}
            </div>

            {decryptedCommentImg && !isCommentImgHidden && (
              <div className="pt-1 max-w-full overflow-hidden">
                <img
                  src={decryptedCommentImg.dataUrl}
                  alt={decryptedCommentImg.fileName}
                  onClick={() => onInspectImage(decryptedCommentImg)}
                  title="Click to inspect full-size image"
                  className="max-h-48 sm:max-h-56 max-w-full rounded-md border border-spruce-200 dark:border-spruce-700 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {hasMultiple && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onToggleHistory(ticketId)}
            className="text-[11px] h-7 px-2 text-spruce-600 dark:text-spruce-400 hover:text-spruce-950 dark:hover:text-white"
          >
            {isHistoryExpanded
              ? `Hide ${earlierComments.length} earlier message${earlierComments.length > 1 ? 's' : ''}`
              : `Show ${earlierComments.length} earlier message${earlierComments.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {hasMultiple && isHistoryExpanded && (
        <div className="space-y-2 pl-2 border-l-2 border-spruce-200 dark:border-spruce-800">
          {earlierComments.map((c) => renderCommentCard(c, false))}
        </div>
      )}

      {latestComment && renderCommentCard(latestComment, true)}
    </div>
  );
}
