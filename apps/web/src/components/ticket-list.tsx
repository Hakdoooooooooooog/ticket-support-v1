'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@ui/input';
import { Button } from '@ui/button';
import { ContextualLoader } from '@ui/contextual-loader';
import {
  ticketsControllerFindAll,
  ticketsControllerUpdate,
} from '../api/endpoints/tickets/tickets';
import {
  formatLastUpdatedTimestamp,
  filterTickets,
  compressAndEncryptImageFile,
  extractApiErrorMessage,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { Ticket, TicketComment } from './tickets/ticket-types';
import { TicketCard } from './tickets/ticket-card';
import { TicketLightbox } from './tickets/ticket-lightbox';

export type { Ticket, TicketComment };

export function TicketList() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    tickets: storedTickets,
    hasLoadedTickets,
    lastUpdatedAt,
    expandedTicketIds,
    expandedCommentHistories,
    viewedTicketIds,
    highlightedTicketId,
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
    markTicketViewed,
    markTicketUnviewed,
    toggleCommentHistory,
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

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const res = (await ticketsControllerFindAll()) as any;
      return res;
    },
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000,
  });

  React.useEffect(() => {
    if (data) {
      setTickets(data);
      initializeDefaultExpansion(data);
      for (const t of data) {
        if (expandedTicketIds[t.id]) {
          void ensureTicketAttachmentsLoaded(t);
        }
      }
    }
  }, [data, dataUpdatedAt, setTickets, initializeDefaultExpansion, expandedTicketIds, ensureTicketAttachmentsLoaded]);

  const tickets = data || (hasLoadedTickets ? storedTickets : []);
  const showInitialSkeleton = isLoading && !hasLoadedTickets;
  const filteredTickets = React.useMemo(() => {
    return filterTickets(tickets, 'ALL', 'ALL', portalSearchQuery);
  }, [tickets, portalSearchQuery]);

  const allExpanded =
    filteredTickets.length > 0 &&
    filteredTickets.every((t) => Boolean(expandedTicketIds[t.id]));

  const toggleExpandAll = () => {
    const next = !allExpanded;
    setAllTicketsExpanded(filteredTickets, next);
    if (next) {
      for (const t of filteredTickets) {
        void ensureTicketAttachmentsLoaded(t);
      }
    }
  };

  const formattedLastUpdated = React.useMemo(() => {
    return formatLastUpdatedTimestamp(dataUpdatedAt, lastUpdatedAt);
  }, [dataUpdatedAt, lastUpdatedAt]);

  const amendTicketMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        title?: string;
        description?: string;
        priority?: Ticket['priority'];
        status?: Ticket['status'];
        amendmentNote?: string;
        actorId?: string;
        encryptedAttachment?: EncryptedAttachmentPayload;
      };
    }) => {
      const res = (await ticketsControllerUpdate(id, payload as any)) as any;
      return res;
    },
    onSuccess: (updated) => {
      upsertTicket(updated);
      setAmendingTicketId(null);
      setAmendAttachment(null);
      setAmendNote('');
      setShowFieldEdit(false);
      setAmendError(null);
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

  const handleToggleExpand = (id: string) => {
    const willExpand = !expandedTicketIds[id];
    toggleTicketExpanded(id);
    if (willExpand) {
      const ticket = tickets.find((t) => t.id === id);
      if (ticket) {
        void ensureTicketAttachmentsLoaded(ticket);
      }
    }
  };

  const handleToggleViewed = (id: string, currentViewed: boolean) => {
    if (currentViewed) {
      markTicketUnviewed(id);
    } else {
      markTicketViewed(id);
    }
  };

  const handleSubmitAmend = (e: React.FormEvent, ticket: Ticket) => {
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
        ...(amendAttachment ? { encryptedAttachment: amendAttachment } : {}),
      },
    });
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight text-spruce-900 dark:text-white">Active Tickets</h2>
          {formattedLastUpdated && (
            <p
              data-testid="portal-last-updated"
              suppressHydrationWarning
              className="text-[11px] text-spruce-600 dark:text-spruce-400 flex items-center gap-1.5"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isFetching ? 'bg-spruce-400 animate-ping' : 'bg-emerald-500'
                }`}
              />
              <span suppressHydrationWarning>
                Last updated: {formattedLastUpdated} (15s auto-poll)
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filteredTickets.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleExpandAll}
              className="h-8 px-2.5 text-xs text-spruce-700 dark:text-spruce-300 font-medium"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title={isFetching ? 'Refreshing tickets...' : 'Refresh tickets'}
            aria-label="Refresh tickets"
            className="h-8 w-8 p-0 shrink-0 text-spruce-700 dark:text-spruce-300"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isFetching ? 'animate-spin text-spruce-500 dark:text-spruce-300' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        </div>
      </div>

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

      {!isLoading && filteredTickets.length === 0 && (
        <div className="text-center py-12 border border-dashed rounded-lg bg-spruce-50/50 dark:bg-spruce-900/20 border-spruce-300 dark:border-spruce-800">
          <p className="text-sm text-spruce-600 dark:text-spruce-400">
            {portalSearchQuery
              ? `No tickets match "${portalSearchQuery}". Try adjusting your search term.`
              : 'You have not submitted any tickets yet. Use the form above to submit your first request.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filteredTickets.map((ticket) => {
          const isExpanded = Boolean(expandedTicketIds[ticket.id]);
          const isViewed = Boolean(viewedTicketIds[ticket.id]);
          const isHighlighted = highlightedTicketId === ticket.id;
          const isAmending = amendingTicketId === ticket.id;
          const isHistoryExpanded = Boolean(expandedCommentHistories[ticket.id]);

          return (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isExpanded={isExpanded}
              isViewed={isViewed}
              isHighlighted={isHighlighted}
              onToggleExpand={handleToggleExpand}
              onToggleViewed={handleToggleViewed}
              currentUserId={user?.id}
              currentUserRole={user?.role}
              decryptedAttachments={decryptedAttachments}
              loadingAttachmentKeys={loadingAttachmentKeys}
              hiddenAttachmentKeys={hiddenAttachmentKeys}
              onToggleAttachmentVisibility={toggleAttachmentVisibility}
              onInspectImage={setLightboxImage}
              isHistoryExpanded={isHistoryExpanded}
              onToggleCommentHistory={toggleCommentHistory}
              isAmending={isAmending}
              onOpenAmend={openAmendPanel}
              onCancelAmend={() => setAmendingTicketId(null)}
              onConfirmResolution={(id) =>
                amendTicketMutation.mutate({
                  id,
                  payload: {
                    status: 'CLOSED',
                    amendmentNote: '[CUSTOMER CONFIRMATION] Confirmed issue resolved.',
                    actorId: user?.id,
                  },
                })
              }
              onReopenTicket={(id) =>
                amendTicketMutation.mutate({
                  id,
                  payload: {
                    status: 'OPEN',
                    amendmentNote: '[CUSTOMER RE-OPEN] Issue still persists after resolution.',
                    actorId: user?.id,
                  },
                })
              }
              isResolvingOrReopening={amendTicketMutation.isPending}
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
              onAmendFileChange={handleAmendFileChange}
              onSubmitAmend={(e) => handleSubmitAmend(e, ticket)}
              isSubmittingAmend={amendTicketMutation.isPending}
              isPreparingAmendImage={isPreparingAmendImage}
              amendError={amendError}
            />
          );
        })}
      </div>

      <TicketLightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
