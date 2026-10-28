'use client';

import * as React from 'react';
import { Card, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import {
  formatTicketDate,
  DecryptedAttachmentResult,
} from '@lib/helpers';
import { CsatRatingWidget } from '@components/csat-rating-widget';
import { Ticket } from './ticket-types';
import { TicketAttachmentPreview } from './ticket-attachment-preview';
import { TicketCommentThread } from './ticket-comment-thread';
import { TicketAmendmentForm } from './ticket-amendment-form';
import { TicketCardHeader, getTicketCardBorderClasses } from './ticket-card-header';

export interface TicketCardProps {
  ticket: Ticket;
  isExpanded: boolean;
  isViewed: boolean;
  isHighlighted: boolean;
  onToggleExpand: (id: string) => void;
  onToggleViewed?: (id: string, currentViewed: boolean) => void;
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

  return (
    <Card
      id={`ticket-${ticket.id}`}
      className={`overflow-hidden transition-all duration-150 ${getTicketCardBorderClasses({
        isHighlighted,
        isViewed,
        status: ticket.status,
      })}`}
    >
      <TicketCardHeader
        ticket={ticket}
        isExpanded={isExpanded}
        isViewed={isViewed}
        onToggleExpand={onToggleExpand}
      />

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
    </Card>
  );
}
