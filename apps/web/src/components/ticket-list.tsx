'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
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
  formatShortTicketId,
  filterTickets,
  compressAndEncryptImageFile,
  fetchAndDecryptTicketAttachment,
  formatByteSize,
  extractApiErrorMessage,
  EncryptedAttachmentPayload,
  DecryptedAttachmentResult,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';

export interface TicketComment {
  id: string;
  content: string;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    email: string;
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
  } | null;
  assigneeId?: string | null;
  assignee?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentOriginalSize?: number | null;
  comments?: TicketComment[];
}

export function TicketList() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const {
    tickets: storedTickets,
    hasLoadedTickets,
    lastUpdatedAt,
    setTickets,
    upsertTicket,
  } = useTicketsStore();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [amendingTicketId, setAmendingTicketId] = React.useState<string | null>(null);
  const [amendTitle, setAmendTitle] = React.useState('');
  const [amendDescription, setAmendDescription] = React.useState('');
  const [amendPriority, setAmendPriority] = React.useState<Ticket['priority']>('MEDIUM');
  const [amendNote, setAmendNote] = React.useState('');
  const [amendAttachment, setAmendAttachment] =
    React.useState<EncryptedAttachmentPayload | null>(null);
  const [isEncryptingAmendImage, setIsEncryptingAmendImage] = React.useState(false);
  const [amendError, setAmendError] = React.useState<string | null>(null);

  const [decryptedAttachments, setDecryptedAttachments] = React.useState<
    Record<string, DecryptedAttachmentResult>
  >({});
  const [loadingAttachmentIds, setLoadingAttachmentIds] = React.useState<
    Record<string, boolean>
  >({});

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
    () => filterTickets(tickets || [], 'ALL', 'ALL', searchQuery),
    [tickets, searchQuery],
  );
  const showInitialSkeleton = isLoading && !hasLoadedTickets;
  const formattedLastUpdated = React.useMemo(
    () => formatLastUpdatedTimestamp(dataUpdatedAt, lastUpdatedAt),
    [dataUpdatedAt, lastUpdatedAt],
  );

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
      setAmendAttachment(null);
      setAmendNote('');
      setAmendError(null);
      // Invalidate cached decrypted preview if attachment was replaced
      setDecryptedAttachments((prev) => {
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => {
      setAmendError(extractApiErrorMessage(err, 'Failed to amend ticket.'));
    },
  });

  const openAmendPanel = (ticket: Ticket) => {
    setAmendingTicketId(ticket.id);
    setAmendTitle(ticket.title);
    setAmendDescription(ticket.description);
    setAmendPriority(ticket.priority);
    setAmendNote('');
    setAmendAttachment(null);
    setAmendError(null);
  };

  const handleAmendFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAmendAttachment(null);
      return;
    }
    setIsEncryptingAmendImage(true);
    try {
      const encrypted = await compressAndEncryptImageFile(file);
      setAmendAttachment(encrypted);
    } catch {
      setAmendError('Could not attach the selected image.');
    } finally {
      setIsEncryptingAmendImage(false);
    }
  };

  const handleToggleAttachment = async (ticketId: string) => {
    if (decryptedAttachments[ticketId]) {
      setDecryptedAttachments((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      return;
    }

    setLoadingAttachmentIds((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const result = await fetchAndDecryptTicketAttachment(ticketId);
      setDecryptedAttachments((prev) => ({ ...prev, [ticketId]: result }));
    } finally {
      setLoadingAttachmentIds((prev) => ({ ...prev, [ticketId]: false }));
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
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-500 hover:text-slate-800 underline dark:text-slate-400"
        >
          {isFetching && hasLoadedTickets ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Customer Ticket Search (Includes #ID, Title, Description) */}
      <Input
        placeholder="Search tickets by #ID, title, or description..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
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
            {searchQuery.trim()
              ? 'No tickets match your search query.'
              : 'No tickets found. Submit your first ticket using the form!'}
          </CardContent>
        </Card>
      )}

      {!showInitialSkeleton &&
        filteredTickets.map((ticket) => {
          const isAmending = amendingTicketId === ticket.id;
          const decrypted = decryptedAttachments[ticket.id];
          const isDecompressing = Boolean(loadingAttachmentIds[ticket.id]);

          return (
            <Card
              key={ticket.id}
              className={`transition-all hover:border-slate-400 ${
                ticket.status === 'NEEDS_INFO'
                  ? 'border-amber-400 dark:border-amber-600'
                  : ''
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">
                        {formatShortTicketId(ticket.id)}
                      </span>
                      <CardTitle className="text-base font-semibold leading-snug">
                        {ticket.title}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
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
              </CardHeader>

              <CardContent className="p-4 pt-0 space-y-3">
                {/* Follow-Up Required Callout */}
                {ticket.status === 'NEEDS_INFO' && (
                  <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                    <span>
                      <strong>Action Required:</strong> IT Support requested additional
                      information or follow-up details on this ticket.
                    </span>
                    {!isAmending && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openAmendPanel(ticket)}
                        className="h-7 text-xs shrink-0"
                      >
                        Provide Info
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {ticket.description}
                </p>

                {ticket.hasAttachment && (
                  <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDecompressing}
                        onClick={() => handleToggleAttachment(ticket.id)}
                        className="h-7 text-xs"
                      >
                        {isDecompressing
                          ? 'Loading...'
                          : decrypted
                            ? 'Hide Attachment'
                            : 'View Attachment'}
                      </Button>
                    </div>

                    {decrypted && (
                      <div className="pt-2 space-y-1.5">
                        <img
                          src={decrypted.dataUrl}
                          alt={decrypted.fileName}
                          className="max-h-64 rounded-md border border-slate-200 dark:border-slate-700 object-contain"
                        />
                       
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>By: {ticket.creator?.fullName || 'Anonymous'}</span>
                    <span>
                      Assigned:{' '}
                      <strong className="text-slate-600 dark:text-slate-200">
                        {ticket.assignee?.fullName || 'Unassigned'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatTicketDate(ticket.createdAt)}</span>
                    {ticket.status !== 'CLOSED' && !isAmending && (
                      <button
                        type="button"
                        onClick={() => openAmendPanel(ticket)}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Amend Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Customer Amend / Follow-Up Form */}
                {isAmending && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formattedNote = amendNote.trim()
                        ? `[CUSTOMER AMENDMENT] ${amendNote.trim()}`
                        : '[CUSTOMER AMENDMENT] Updated ticket details.';
                      amendTicketMutation.mutate({
                        id: ticket.id,
                        payload: {
                          title: amendTitle.trim(),
                          description: amendDescription.trim(),
                          priority: amendPriority,
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Amend Ticket {formatShortTicketId(ticket.id)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setAmendingTicketId(null)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>

                    {amendError && (
                      <p className="text-xs text-red-500 font-medium">{amendError}</p>
                    )}

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
                            setAmendPriority(e.target.value as Ticket['priority'])
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

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Additional Clarification / Follow-Up Note (Optional)
                      </Label>
                      <Input
                        placeholder="Explain what changed or answer IT Support's follow-up question..."
                        value={amendNote}
                        onChange={(e) => setAmendNote(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">
                        Add / Replace Screenshot Attachment
                      </Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleAmendFileChange}
                        className="h-8 text-xs cursor-pointer"
                      />
                      {amendAttachment && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Selected: {amendAttachment.fileName} (
                          {formatByteSize(amendAttachment.originalSize)})
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAmendingTicketId(null)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          amendTicketMutation.isPending || isEncryptingAmendImage
                        }
                        className="h-7 text-xs"
                      >
                        {amendTicketMutation.isPending
                          ? 'Saving Amendment...'
                          : 'Save Amendment'}
                      </Button>
                    </div>
                  </form>
                )}

                {ticket.comments && ticket.comments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      IT Support Updates &amp; Amendments ({ticket.comments.length})
                    </p>
                    {ticket.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="text-xs p-2 rounded bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                      >
                        <span className="font-semibold">
                          {comment.author?.fullName || 'IT Support'}:{' '}
                        </span>
                        <span>{comment.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
