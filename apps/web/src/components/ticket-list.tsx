'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardTitle, CardContent } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Textarea } from '@ui/textarea';
import { Label } from '@ui/label';
import { ContextualLoader } from '@ui/contextual-loader';
import { apiClient } from '@lib/api-client';
import {
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  formatLastUpdatedTimestamp,
  formatTicketDate,
  formatCommentTime,
  formatShortTicketId,
  filterTickets,
  compressAndEncryptImageFile,
  parseTimelineComment,
  countTicketAttachments,
  formatByteSize,
  extractApiErrorMessage,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { CsatRatingWidget } from '@components/csat-rating-widget';

export interface TicketComment {
  id: string;
  content: string;
  createdAt: string;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  author?: {
    id: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'NEEDS_INFO' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  creatorId?: string;
  creator?: {
    id?: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
    role?: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  } | null;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  comments?: TicketComment[];
  csatRating?: number | null;
  csatComment?: string | null;
  csatRatedAt?: string | null;
}

export function TicketList() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    tickets: storedTickets,
    hasLoadedTickets,
    lastUpdatedAt,
    expandedTicketIds,
    portalSearchQuery,
    decryptedAttachments,
    loadingAttachmentKeys,
    hiddenAttachmentKeys,
    lightboxImage,
    setTickets,
    upsertTicket,
    setPortalSearchQuery,
    initializeDefaultExpansion,
    toggleTicketExpanded,
    setTicketExpanded,
    setAllTicketsExpanded,
    ensureTicketAttachmentsLoaded,
    toggleAttachmentVisibility,
    setLightboxImage,
  } = useTicketsStore();

  const [amendingTicketId, setAmendingTicketId] = React.useState<string | null>(null);
  const [showFieldEdit, setShowFieldEdit] = React.useState(false);
  const [amendTitle, setAmendTitle] = React.useState('');
  const [amendDescription, setAmendDescription] = React.useState('');
  const [amendPriority, setAmendPriority] = React.useState<Ticket['priority']>('MEDIUM');
  const [amendNote, setAmendNote] = React.useState('');
  const [amendAttachment, setAmendAttachment] =
    React.useState<EncryptedAttachmentPayload | null>(null);
  const [isPreparingAmendImage, setIsPreparingAmendImage] = React.useState(false);
  const [amendError, setAmendError] = React.useState<string | null>(null);

  const {
    data: queriedTickets,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    initialData: hasLoadedTickets ? storedTickets : undefined,
    refetchOnWindowFocus: 'always',
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      try {
        const res = await apiClient.get('/tickets');
        setTickets(res.data);
        return res.data;
      } catch {
        return storedTickets;
      }
    },
  });

  const tickets = queriedTickets ?? storedTickets;
  const filteredTickets = React.useMemo(
    () => filterTickets(tickets || [], 'ALL', 'ALL', portalSearchQuery),
    [tickets, portalSearchQuery],
  );

  // Auto-expand NEEDS_INFO tickets or the first ticket on initial load via Zustand
  React.useEffect(() => {
    if (filteredTickets.length > 0) {
      initializeDefaultExpansion(filteredTickets);
    }
  }, [filteredTickets, initializeDefaultExpansion]);

  // Automatically load attachments once whenever a ticket accordion is expanded (viewed)
  React.useEffect(() => {
    filteredTickets.forEach((ticket) => {
      if (expandedTicketIds[ticket.id]) {
        void ensureTicketAttachmentsLoaded(ticket);
      }
    });
  }, [filteredTickets, expandedTicketIds, ensureTicketAttachmentsLoaded]);

  const showInitialSkeleton = isLoading && !hasLoadedTickets;
  const formattedLastUpdated = React.useMemo(
    () => formatLastUpdatedTimestamp(dataUpdatedAt, lastUpdatedAt),
    [dataUpdatedAt, lastUpdatedAt],
  );

  const allExpanded =
    filteredTickets.length > 0 &&
    filteredTickets.every((t) => Boolean(expandedTicketIds[t.id]));

  const toggleExpandAll = () => {
    setAllTicketsExpanded(filteredTickets, !allExpanded);
  };

  const amendTicketMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => {
      const res = await apiClient.patch(`/tickets/${id}`, payload);
      return res.data as Ticket;
    },
    onSuccess: (updated) => {
      upsertTicket(updated);
      setAmendingTicketId(null);
      setShowFieldEdit(false);
      setAmendAttachment(null);
      setAmendNote('');
      setAmendError(null);
      setTicketExpanded(updated.id, true);
      void ensureTicketAttachmentsLoaded(updated);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => {
      setAmendError(extractApiErrorMessage(err, 'Failed to submit update.'));
    },
  });

  const openAmendPanel = (ticket: Ticket, editFields = false) => {
    setTicketExpanded(ticket.id, true);
    setAmendingTicketId(ticket.id);
    setShowFieldEdit(editFields);
    setAmendTitle(ticket.title);
    setAmendDescription(ticket.description);
    setAmendPriority(ticket.priority);
    setAmendNote('');
    setAmendAttachment(null);
    setAmendError(null);
  };

  const handleAmendFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAmendError(null);
    if (!file) {
      setAmendAttachment(null);
      return;
    }
    setIsPreparingAmendImage(true);
    try {
      const encrypted = await compressAndEncryptImageFile(file);
      setAmendAttachment(encrypted);
    } catch {
      setAmendError('Could not attach the selected image.');
    } finally {
      setIsPreparingAmendImage(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight">Active Tickets</h2>
          {formattedLastUpdated && (
            <p
              data-testid="portal-last-updated"
              className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isFetching ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
                }`}
              />
              <span>Last updated: {formattedLastUpdated} (15s auto-poll)</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {filteredTickets.length > 0 && (
            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-xs text-slate-500 hover:text-slate-800 underline dark:text-slate-400"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-slate-500 hover:text-slate-800 underline dark:text-slate-400"
          >
            {isFetching && hasLoadedTickets ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Customer Ticket Search (Includes #ID, Title, Description) */}
      <Input
        placeholder="Search tickets by #ID, title, or description..."
        value={portalSearchQuery}
        onChange={(e) => setPortalSearchQuery(e.target.value)}
        className="text-xs"
      />

      {showInitialSkeleton && <ContextualLoader context="customer-tickets" count={3} />}

      {isError && (
        <div className="p-4 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200">
          Unable to load tickets right now. Please try refreshing the page.
        </div>
      )}

      {!showInitialSkeleton && filteredTickets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            {portalSearchQuery.trim()
              ? 'No tickets match your search query.'
              : 'No tickets found. Submit your first ticket using the form!'}
          </CardContent>
        </Card>
      )}

      {!showInitialSkeleton &&
        filteredTickets.map((ticket) => {
          const isExpanded = Boolean(expandedTicketIds[ticket.id]);
          const isAmending = amendingTicketId === ticket.id;
          const ticketAttachmentKey = `ticket:${ticket.id}`;
          const decryptedTicketImg = decryptedAttachments[ticketAttachmentKey];
          const isLoadingTicketImg = Boolean(loadingAttachmentKeys[ticketAttachmentKey]);
          const isTicketImgHidden = Boolean(hiddenAttachmentKeys[ticketAttachmentKey]);
          const commentCount = ticket.comments?.length || 0;
          const attachmentCount = countTicketAttachments(ticket);

          return (
            <Card
              key={ticket.id}
              id={`ticket-${ticket.id}`}
              className={`overflow-hidden transition-all ${
                ticket.status === 'NEEDS_INFO'
                  ? 'border-amber-400 dark:border-amber-600'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Accordion Header */}
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleTicketExpanded(ticket.id)}
                className="w-full text-left p-4 hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors focus:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-[10px] text-slate-600 dark:text-slate-300 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    >
                      ▸
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">
                          {formatShortTicketId(ticket.id)}
                        </span>
                        <CardTitle className="text-base font-semibold leading-snug">
                          {ticket.title}
                        </CardTitle>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>{formatTicketDate(ticket.createdAt)}</span>
                        <span>
                          Assigned:{' '}
                          <strong className="text-slate-600 dark:text-slate-300">
                            {ticket.assignee?.fullName || 'Unassigned'}
                          </strong>
                        </span>
                        <span>
                          {commentCount} {commentCount === 1 ? 'message' : 'messages'}
                        </span>
                        {attachmentCount > 0 && (
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {attachmentCount}{' '}
                            {attachmentCount === 1 ? 'attachment' : 'attachments'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(ticket.status)}>
                      {ticket.status === 'NEEDS_INFO'
                        ? 'NEEDS ADDITIONAL INFO'
                        : ticket.status}
                    </Badge>
                  </div>
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <CardContent className="p-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                  {/* Follow-Up Required Callout */}
                  {ticket.status === 'NEEDS_INFO' && (
                    <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>Follow-Up Requested:</strong> Support requested
                        additional details or a screenshot on this ticket.
                      </span>
                      {!isAmending && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openAmendPanel(ticket, false)}
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
                        <strong>Marked Resolved:</strong> Please confirm if your issue is
                        fixed or re-open the ticket if you still need assistance.
                      </span>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          disabled={amendTicketMutation.isPending}
                          onClick={() =>
                            amendTicketMutation.mutate({
                              id: ticket.id,
                              payload: {
                                status: 'CLOSED',
                                amendmentNote:
                                  '[CUSTOMER AMENDMENT] Confirmed issue is resolved and closed the ticket.',
                                actorId: user?.id,
                              },
                            })
                          }
                          className="h-7 text-xs"
                        >
                          Confirm Resolved &amp; Close
                        </Button>
                        {!isAmending && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openAmendPanel(ticket, false)}
                            className="h-7 text-xs"
                          >
                            Still Having Issues (Re-Open)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer Closed Ticket Callout & Re-Open */}
                  {ticket.status === 'CLOSED' && (
                    <div className="p-3 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>Ticket Closed:</strong> This support request has been completed and closed.
                      </span>
                      {!isAmending && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openAmendPanel(ticket, false)}
                          className="h-7 text-xs"
                        >
                          Re-Open Ticket
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Customer Satisfaction Feedback Widget */}
                  {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
                    <CsatRatingWidget
                      ticketId={ticket.id}
                      initialRating={ticket.csatRating}
                      initialComment={ticket.csatComment}
                      ratedAt={ticket.csatRatedAt}
                    />
                  )}

                  {/* 1. Original Ticket Report */}
                  <div className="p-3 rounded-lg bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold uppercase tracking-wider text-slate-500">
                        Initial Ticket Report
                      </span>
                      <span>
                        Reported by {ticket.creator?.fullName || 'Customer'} ·{' '}
                        {formatTicketDate(ticket.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {ticket.description}
                    </p>

                    {/* Initial Ticket Attachment (auto-loaded once when viewed) */}
                    {ticket.hasAttachment && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {ticket.attachmentName || 'attachment.webp'}
                            </span>
                            {ticket.attachmentOriginalSize && (
                              <span className="text-slate-400">
                                ({formatByteSize(ticket.attachmentOriginalSize)})
                              </span>
                            )}
                          </div>
                          {decryptedTicketImg ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleAttachmentVisibility(ticketAttachmentKey)
                              }
                              className="h-7 text-xs"
                            >
                              {isTicketImgHidden ? 'Show Image' : 'Hide Image'}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {isLoadingTicketImg ? 'Loading image...' : ''}
                            </span>
                          )}
                        </div>

                        {decryptedTicketImg && !isTicketImgHidden && (
                          <div className="pt-1">
                            <img
                              src={decryptedTicketImg.dataUrl}
                              alt={decryptedTicketImg.fileName}
                              onClick={() => setLightboxImage(decryptedTicketImg)}
                              title="Click to inspect full-size image"
                              className="max-h-64 rounded-md border border-slate-200 dark:border-slate-700 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Chronological Activity & Follow-Up History Timeline */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Activity &amp; Follow-Up History ({commentCount})
                      </p>
                      {ticket.status !== 'CLOSED' && !isAmending && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAmendPanel(ticket, false)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            Add Follow-Up Reply
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <button
                            type="button"
                            onClick={() => openAmendPanel(ticket, true)}
                            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline"
                          >
                            Amend Ticket Details
                          </button>
                        </div>
                      )}
                    </div>

                    {commentCount === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        No follow-up messages or support notes yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5 pl-2 border-l-2 border-slate-200 dark:border-slate-800">
                        {ticket.comments?.map((comment) => {
                          const parsed = parseTimelineComment(comment.content);
                          const commentAttachmentKey = `comment:${comment.id}`;
                          const decryptedCommentImg =
                            decryptedAttachments[commentAttachmentKey];
                          const isLoadingCommentImg = Boolean(
                            loadingAttachmentKeys[commentAttachmentKey],
                          );
                          const isCommentImgHidden = Boolean(
                            hiddenAttachmentKeys[commentAttachmentKey],
                          );

                          const cardTone =
                            parsed.kind === 'FOLLOW_UP'
                              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80'
                              : parsed.kind === 'AMENDMENT'
                                ? 'bg-blue-50/50 dark:bg-blue-950/25 border-blue-200/80 dark:border-blue-900/70'
                                : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200/70 dark:border-slate-800';

                          return (
                            <div
                              key={comment.id}
                              className={`p-3 rounded-lg border text-xs space-y-2 ${cardTone}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {comment.author?.fullName || 'Support'}
                                  </span>
                                  {comment.author?.role && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] py-0 px-1.5"
                                    >
                                      {comment.author.role}
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      parsed.kind === 'FOLLOW_UP'
                                        ? 'warning'
                                        : parsed.kind === 'AMENDMENT'
                                          ? 'default'
                                          : 'secondary'
                                    }
                                    className="text-[10px] py-0 px-1.5"
                                  >
                                    {parsed.badgeLabel}
                                  </Badge>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  {formatCommentTime(comment.createdAt)}
                                </span>
                              </div>

                              <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {parsed.cleanText}
                              </p>

                              {/* Attachment linked directly to this Follow-Up / Amendment message (auto-loaded once when viewed) */}
                              {comment.hasAttachment && (
                                <div className="p-2.5 rounded-md bg-white/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {comment.attachmentName || 'attachment.webp'}
                                      </span>
                                      {comment.attachmentOriginalSize && (
                                        <span className="text-slate-400">
                                          (
                                          {formatByteSize(comment.attachmentOriginalSize)}
                                          )
                                        </span>
                                      )}
                                    </div>
                                    {decryptedCommentImg ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          toggleAttachmentVisibility(commentAttachmentKey)
                                        }
                                        className="h-7 text-xs"
                                      >
                                        {isCommentImgHidden ? 'Show Image' : 'Hide Image'}
                                      </Button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">
                                        {isLoadingCommentImg ? 'Loading image...' : ''}
                                      </span>
                                    )}
                                  </div>

                                  {decryptedCommentImg && !isCommentImgHidden && (
                                    <div className="pt-1">
                                      <img
                                        src={decryptedCommentImg.dataUrl}
                                        alt={decryptedCommentImg.fileName}
                                        onClick={() =>
                                          setLightboxImage(decryptedCommentImg)
                                        }
                                        title="Click to inspect full-size image"
                                        className="max-h-64 rounded-md border border-slate-200 dark:border-slate-700 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Inline Customer Follow-Up Reply & Amendment Composer */}
                  {isAmending && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmedNote = amendNote.trim();
                        const formattedNote = trimmedNote
                          ? `[CUSTOMER AMENDMENT] ${trimmedNote}`
                          : amendAttachment
                            ? `[CUSTOMER AMENDMENT] Attached ${amendAttachment.fileName}`
                            : '[CUSTOMER AMENDMENT] Updated ticket details.';

                        amendTicketMutation.mutate({
                          id: ticket.id,
                          payload: {
                            ...(showFieldEdit
                              ? {
                                  title: amendTitle.trim(),
                                  description: amendDescription.trim(),
                                  priority: amendPriority,
                                }
                              : {}),
                            amendmentNote: formattedNote,
                            actorId: user?.id,
                            ...(amendAttachment
                              ? { encryptedAttachment: amendAttachment }
                              : {}),
                          },
                        });
                      }}
                      className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                          {showFieldEdit
                            ? `Amend Ticket ${formatShortTicketId(ticket.id)}`
                            : `Follow-Up Reply on ${formatShortTicketId(ticket.id)}`}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowFieldEdit((v) => !v)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {showFieldEdit
                              ? 'Hide Ticket Field Edits'
                              : 'Edit Title / Priority / Description'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAmendingTicketId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>

                      {amendError && (
                        <p className="text-xs text-red-500 font-medium">{amendError}</p>
                      )}

                      {showFieldEdit && (
                        <div className="space-y-2.5 p-2.5 rounded-md bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2 space-y-1">
                              <Label className="text-xs">Amended Title</Label>
                              <Input
                                value={amendTitle}
                                onChange={(e) => setAmendTitle(e.target.value)}
                                className="h-8 text-xs"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Priority</Label>
                              <select
                                value={amendPriority}
                                onChange={(e) =>
                                  setAmendPriority(
                                    e.target.value as Ticket['priority'],
                                  )
                                }
                                className="flex h-8 w-full rounded-md border border-slate-200 bg-transparent px-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                              >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                                <option value="URGENT">URGENT</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Amended Description</Label>
                            <Textarea
                              rows={3}
                              value={amendDescription}
                              onChange={(e) => setAmendDescription(e.target.value)}
                              className="text-xs"
                              required
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">
                          Follow-Up Message / Clarification Note
                        </Label>
                        <Textarea
                          rows={2}
                          placeholder="Provide the requested details or explain what changed..."
                          value={amendNote}
                          onChange={(e) => setAmendNote(e.target.value)}
                          className="text-xs"
                          required={!showFieldEdit && !amendAttachment}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">
                          Attach Screenshot to This Message (Optional)
                        </Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleAmendFileChange}
                          className="h-8 text-xs cursor-pointer"
                        />
                        {amendAttachment && (
                          <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 pt-0.5">
                            <span>
                              Attached to message: {amendAttachment.fileName} (
                              {formatByteSize(amendAttachment.originalSize)})
                            </span>
                            <button
                              type="button"
                              onClick={() => setAmendAttachment(null)}
                              className="text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAmendingTicketId(null)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            amendTicketMutation.isPending || isPreparingAmendImage
                          }
                          className="h-8 text-xs"
                        >
                          {amendTicketMutation.isPending
                            ? 'Saving...'
                            : 'Submit Follow-Up'}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

      {/* Full-Screen Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 text-xs text-slate-200">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold truncate">{lightboxImage.fileName}</span>
                <span className="text-slate-400">
                  ({formatByteSize(lightboxImage.originalSize)})
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLightboxImage(null)}
                className="h-7 text-xs"
              >
                Close Preview
              </Button>
            </div>
            <div className="flex items-center justify-center max-h-[80vh] overflow-auto bg-slate-950 rounded-lg p-2">
              <img
                src={lightboxImage.dataUrl}
                alt={lightboxImage.fileName}
                className="max-h-[76vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
