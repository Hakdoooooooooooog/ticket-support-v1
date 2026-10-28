'use client';

import * as React from 'react';
import { Card, CardContent } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import {
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  formatTicketDate,
  formatShortTicketId,
  countTicketAttachments,
  DecryptedAttachmentResult,
} from '@lib/helpers';
import { CsatRatingWidget } from '@components/csat-rating-widget';
import { Ticket } from './ticket-types';
import { TicketAttachmentPreview } from './ticket-attachment-preview';
import { TicketCommentThread } from './ticket-comment-thread';
import { TicketAmendmentForm } from './ticket-amendment-form';

export interface TicketCardProps {
  ticket: Ticket;
  isExpanded: boolean;
  isViewed: boolean;
  isHighlighted: boolean;
  onToggleExpand: (id: string) => void;
  onToggleViewed: (id: string, currentViewed: boolean) => void;
  // User info
  currentUserId?: string;
  currentUserRole?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  // Attachments
  decryptedAttachments: Record<string, DecryptedAttachmentResult>;
  loadingAttachmentKeys: Record<string, boolean>;
  hiddenAttachmentKeys: Record<string, boolean>;
  onToggleAttachmentVisibility: (key: string) => void;
  onInspectImage: (payload: DecryptedAttachmentResult) => void;
  // Comment threads
  isHistoryExpanded: boolean;
  onToggleCommentHistory: (ticketId: string) => void;
  // Amendment / Follow-up state
  isAmending: boolean;
  onOpenAmend: (ticket: Ticket, showFieldEdit: boolean) => void;
  onCancelAmend: () => void;
  onConfirmResolution: (ticketId: string) => void;
  onReopenTicket: (ticketId: string) => void;
  isResolvingOrReopening: boolean;
  // Amendment form props
  showFieldEdit: boolean;
  setShowFieldEdit: React.Dispatch<React.SetStateAction<boolean>>;
  amendTitle: string;
  setAmendTitle: (val: string) => void;
  amendDescription: string;
  setAmendDescription: (val: string) => void;
  amendPriority: Ticket['priority'];
  setAmendPriority: (val: Ticket['priority']) => void;
  amendNote: string;
  setAmendNote: (val: string) => void;
  amendAttachment: any;
  setAmendAttachment: (val: any) => void;
  onAmendFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmitAmend: (e: React.FormEvent) => void;
  isSubmittingAmend: boolean;
  isPreparingAmendImage: boolean;
  amendError?: string | null;
}

export function TicketCard({
  ticket,
  isExpanded,
  isViewed,
  isHighlighted,
  onToggleExpand,
  onToggleViewed,
  currentUserId,
  currentUserRole,
  decryptedAttachments,
  loadingAttachmentKeys,
  hiddenAttachmentKeys,
  onToggleAttachmentVisibility,
  onInspectImage,
  isHistoryExpanded,
  onToggleCommentHistory,
  isAmending,
  onOpenAmend,
  onCancelAmend,
  onConfirmResolution,
  onReopenTicket,
  isResolvingOrReopening,
  showFieldEdit,
  setShowFieldEdit,
  amendTitle,
  setAmendTitle,
  amendDescription,
  setAmendDescription,
  amendPriority,
  setAmendPriority,
  amendNote,
  setAmendNote,
  amendAttachment,
  setAmendAttachment,
  onAmendFileChange,
  onSubmitAmend,
  isSubmittingAmend,
  isPreparingAmendImage,
  amendError,
}: TicketCardProps) {
  const ticketAttachmentKey = `ticket:${ticket.id}`;
  const decryptedTicketImg = decryptedAttachments[ticketAttachmentKey];
  const isLoadingTicketImg = Boolean(loadingAttachmentKeys[ticketAttachmentKey]);
  const isTicketImgHidden = Boolean(hiddenAttachmentKeys[ticketAttachmentKey]);
  const commentCount = ticket.comments?.length || 0;
  const attachmentCount = countTicketAttachments(ticket);

  return (
    <Card
      id={`ticket-${ticket.id}`}
      className={`overflow-hidden transition-all duration-150 ${
        isHighlighted
          ? 'ring-2 ring-spruce-500 shadow-md bg-spruce-50/40 dark:bg-spruce-900/30'
          : !isViewed
            ? 'border-l-4 border-l-spruce-500 dark:border-l-spruce-400 bg-spruce-50/20 dark:bg-spruce-900/10'
            : 'border-l-4 border-l-transparent opacity-95'
      }`}
    >
      {/* Accordion Trigger */}
      <div className="p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:p-5">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => onToggleExpand(ticket.id)}
            className="w-full text-left flex flex-col lg:flex-row lg:items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 rounded-lg"
          >
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-spruce-600 dark:text-spruce-400">
                  {formatShortTicketId(ticket.id)}
                </span>
                {!isViewed ? (
                  <Badge
                    variant="default"
                    className="text-[10px] py-0 px-1.5 bg-spruce-600 text-white dark:bg-spruce-300 dark:text-spruce-950 font-bold tracking-tight"
                  >
                    New
                  </Badge>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-spruce-500 dark:text-spruce-400 px-1.5 py-0.2 rounded bg-spruce-100/60 dark:bg-spruce-900/50">
                    <svg className="w-3 h-3 text-spruce-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Viewed</span>
                  </span>
                )}
                <h3 className="font-semibold text-base sm:text-lg text-spruce-950 dark:text-white truncate">
                  {ticket.title}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-spruce-500 dark:text-spruce-400">
                <span>Reported by {ticket.creator?.fullName || 'Customer'}</span>
                <span>·</span>
                <span>{formatTicketDate(ticket.createdAt)}</span>
                <span>·</span>
                <span>
                  {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
                </span>
                {attachmentCount > 0 && (
                  <span className="text-spruce-700 dark:text-spruce-300 font-medium">
                    {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
                  </span>
                )}
                {typeof ticket.csatRating === 'number' && (
                  <span className="text-emerald-500 font-medium">CSAT {ticket.csatRating}.0</span>
                )}
              </div>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-spruce-300 dark:border-spruce-700 bg-spruce-50/50 dark:bg-spruce-900/50 text-spruce-700 dark:text-spruce-300"
            >
              {ticket.department === 'GENERAL' ? 'General Scope' : 'Tech Support'}
            </Badge>
            <Badge variant={getPriorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge>
            <Badge variant={getStatusBadgeVariant(ticket.status)}>
              {ticket.status === 'NEEDS_INFO' ? 'NEEDS ADDITIONAL INFO' : ticket.status}
            </Badge>
            <button
              type="button"
              onClick={() => onToggleViewed(ticket.id, isViewed)}
              title={isViewed ? 'Mark as unread / new' : 'Mark as viewed'}
              className="p-1 rounded text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400"
              aria-label={isViewed ? 'Mark ticket as unviewed' : 'Mark ticket as viewed'}
            >
              {isViewed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-spruce-600 dark:text-spruce-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Accordion Body */}
        {isExpanded && (
          <CardContent className="p-4 pt-3 border-t border-spruce-100 dark:border-spruce-800/80 space-y-4">
            {/* Follow-Up Required Callout */}
            {ticket.status === 'NEEDS_INFO' && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Follow-Up Requested:</strong> Support requested additional details or a screenshot on this ticket.
                </span>
                {!isAmending && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenAmend(ticket, false)}
                    className="h-7 text-xs shrink-0"
                  >
                    Reply &amp; Attach Info
                  </Button>
                )}
              </div>
            )}

            {/* Customer Resolution Confirmation / Re-Open Callout */}
            {ticket.status === 'RESOLVED' && (
              <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Marked Resolved:</strong> Please confirm if your issue is fixed or re-open the ticket if you still need assistance.
                </span>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isResolvingOrReopening}
                    onClick={() => onConfirmResolution(ticket.id)}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    Confirm &amp; Close Ticket
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isResolvingOrReopening}
                    onClick={() => onReopenTicket(ticket.id)}
                    className="h-7 text-xs border-spruce-300 dark:border-spruce-700 hover:bg-spruce-100 dark:hover:bg-spruce-800"
                  >
                    Not Fixed (Re-Open)
                  </Button>
                </div>
              </div>
            )}

            {/* CSAT Feedback Widget */}
            {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
              <CsatRatingWidget
                ticketId={ticket.id}
                creatorId={ticket.creatorId}
                creatorName={ticket.creator?.fullName}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                initialRating={ticket.csatRating}
                initialComment={ticket.csatComment}
                ratedAt={ticket.csatRatedAt}
              />
            )}

            {/* Initial Ticket Report */}
            <div className="p-3 rounded-lg bg-spruce-50/80 dark:bg-spruce-900/50 border border-spruce-200/70 dark:border-spruce-800 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-spruce-500 dark:text-spruce-400">
                <span className="font-semibold uppercase tracking-wider text-spruce-600 dark:text-spruce-400">
                  Initial Ticket Report
                </span>
                <span>
                  Reported by {ticket.creator?.fullName || 'Customer'} · {formatTicketDate(ticket.createdAt)}
                </span>
              </div>
              <p className="text-sm text-spruce-800 dark:text-spruce-200 whitespace-pre-wrap">
                {ticket.description}
              </p>

              {/* Initial Ticket Attachment */}
              {ticket.hasAttachment && (
                <TicketAttachmentPreview
                  attachmentName={ticket.attachmentName}
                  attachmentOriginalSize={ticket.attachmentOriginalSize}
                  decryptedImage={decryptedTicketImg}
                  isLoading={isLoadingTicketImg}
                  isHidden={isTicketImgHidden}
                  onToggleVisibility={() => onToggleAttachmentVisibility(ticketAttachmentKey)}
                  onClickPreview={onInspectImage}
                />
              )}
            </div>

            {/* Activity & Follow-Up History Timeline */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-spruce-500 uppercase tracking-wider">
                  Activity &amp; Follow-Up History ({commentCount})
                </p>
                {ticket.status !== 'CLOSED' && !isAmending && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAmend(ticket, false)}
                      className="text-xs text-spruce-700 dark:text-spruce-300 hover:underline font-medium"
                    >
                      Add Follow-Up Reply
                    </button>
                    <span className="text-spruce-300 dark:text-spruce-700">·</span>
                    <button
                      type="button"
                      onClick={() => onOpenAmend(ticket, true)}
                      className="text-xs text-spruce-500 hover:text-spruce-800 dark:hover:text-spruce-200 hover:underline"
                    >
                      Amend Ticket Details
                    </button>
                  </div>
                )}
              </div>

              <TicketCommentThread
                comments={ticket.comments}
                ticketId={ticket.id}
                isHistoryExpanded={isHistoryExpanded}
                onToggleHistory={onToggleCommentHistory}
                decryptedAttachments={decryptedAttachments}
                loadingAttachmentKeys={loadingAttachmentKeys}
                hiddenAttachmentKeys={hiddenAttachmentKeys}
                onToggleAttachmentVisibility={onToggleAttachmentVisibility}
                onInspectImage={onInspectImage}
              />
            </div>

            {/* Inline Customer Follow-Up Reply & Amendment Composer */}
            {isAmending && (
              <TicketAmendmentForm
                ticket={ticket}
                showFieldEdit={showFieldEdit}
                setShowFieldEdit={setShowFieldEdit}
                amendTitle={amendTitle}
                setAmendTitle={setAmendTitle}
                amendDescription={amendDescription}
                setAmendDescription={setAmendDescription}
                amendPriority={amendPriority}
                setAmendPriority={setAmendPriority}
                amendNote={amendNote}
                setAmendNote={setAmendNote}
                amendAttachment={amendAttachment}
                setAmendAttachment={setAmendAttachment}
                onFileChange={onAmendFileChange}
                onCancel={onCancelAmend}
                onSubmit={onSubmitAmend}
                isSubmitting={isSubmittingAmend}
                isPreparingImage={isPreparingAmendImage}
                error={amendError}
              />
            )}
          </CardContent>
        )}
      </div>
    </Card>
  );
}
