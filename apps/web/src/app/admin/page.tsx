'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Input } from '@ui/input';
import { ContextualLoader } from '@ui/contextual-loader';
import { apiClient } from '@lib/api-client';
import {
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  getStoredSession,
  formatLastUpdatedTimestamp,
  formatTicketDateTime,
  formatCommentTime,
  formatShortTicketId,
  filterTickets,
  computeTicketKpis,
  resolveTicketAssigneeId,
  compressAndEncryptImageFile,
  formatByteSize,
  parseTimelineComment,
  countTicketAttachments,
  computeTicketSlaStatus,
  extractApiErrorMessage,
  sanitizeText,
  AuthUser,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import { Ticket } from '@components/ticket-list';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { useAdminStore } from '@store/admin.store';

export default function AdminDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    user,
    isSessionVerified,
    isVerifyingSession,
    ensureSessionVerified,
    clearSession,
  } = useAuthStore();
  const {
    tickets: storedTickets,
    hasLoadedTickets,
    lastUpdatedAt,
    expandedTicketIds,
    decryptedAttachments,
    loadingAttachmentKeys,
    hiddenAttachmentKeys,
    lightboxImage,
    setTickets,
    upsertTicket,
    removeTicket,
    clearTickets,
    initializeDefaultExpansion,
    toggleTicketExpanded,
    setAllTicketsExpanded,
    ensureTicketAttachmentsLoaded,
    toggleAttachmentVisibility,
    setLightboxImage,
  } = useTicketsStore();
  const {
    agents: storedAgents,
    hasLoadedAgents,
    activeSection,
    assignedScope,
    assignmentFilter,
    statusFilter,
    priorityFilter,
    searchQuery,
    commentDrafts,
    followUpTicketId,
    followUpPrompt,
    setAgents,
    setActiveSection,
    setAssignedScope,
    setAssignmentFilter,
    setStatusFilter,
    setPriorityFilter,
    setSearchQuery,
    setCommentDraft,
    openFollowUpComposer,
    closeFollowUpComposer,
    setFollowUpPrompt,
  } = useAdminStore();

  const [commentAttachments, setCommentAttachments] = React.useState<
    Record<string, File | null>
  >({});
  const [followUpAttachment, setFollowUpAttachment] = React.useState<File | null>(null);
  const [actionErrors, setActionErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isSessionVerified && user) {
      return;
    }

    const stored = getStoredSession();
    if (!stored?.accessToken && !user) {
      router.replace('/');
      return;
    }

    ensureSessionVerified().then((verified) => {
      if (!verified) {
        router.replace('/');
      }
    });
  }, [isSessionVerified, user, ensureSessionVerified, router]);

  const {
    data: queriedTickets,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    initialData: hasLoadedTickets ? storedTickets : undefined,
    refetchOnWindowFocus: 'always',
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      const res = await apiClient.get('/tickets');
      setTickets(res.data);
      return res.data;
    },
  });

  const tickets = queriedTickets ?? storedTickets;
  const showInitialSkeleton = isLoading && !hasLoadedTickets;
  const formattedLastUpdated = React.useMemo(
    () => formatLastUpdatedTimestamp(dataUpdatedAt, lastUpdatedAt),
    [dataUpdatedAt, lastUpdatedAt],
  );

  // Auto-expand the first ticket and any NEEDS_INFO ticket on initial load via Zustand
  React.useEffect(() => {
    if (tickets.length > 0) {
      initializeDefaultExpansion(tickets);
    }
  }, [tickets, initializeDefaultExpansion]);

  const { data: queriedAgents } = useQuery<AuthUser[]>({
    queryKey: ['agents'],
    initialData: hasLoadedAgents ? storedAgents : undefined,
    refetchOnWindowFocus: 'always',
    refetchInterval: 15 * 1000,
    queryFn: async () => {
      try {
        const res = await apiClient.get('/auth/agents');
        setAgents(res.data);
        return res.data;
      } catch {
        return storedAgents;
      }
    },
  });

  const agents = queriedAgents ?? storedAgents;

  const updateTicketMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>> & {
        amendmentNote?: string;
        actorId?: string;
        encryptedAttachment?: EncryptedAttachmentPayload | null;
      };
    }) => {
      const res = await apiClient.patch(`/tickets/${id}`, payload);
      return res.data as Ticket;
    },
    onSuccess: (updatedTicket) => {
      if (updatedTicket?.id) {
        upsertTicket(updatedTicket);
        void ensureTicketAttachmentsLoaded(updatedTicket);
        setActionErrors((prev) => ({ ...prev, [updatedTicket.id]: '' }));
      }
      closeFollowUpComposer();
      setFollowUpAttachment(null);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err: unknown, variables) => {
      const message = extractApiErrorMessage(err, 'Failed to update ticket');
      setActionErrors((prev) => ({ ...prev, [variables.id]: message }));
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({
      ticketId,
      content,
      encryptedAttachment,
    }: {
      ticketId: string;
      content: string;
      encryptedAttachment?: EncryptedAttachmentPayload;
    }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/comments`, {
        content,
        authorId: user?.id,
        ...(encryptedAttachment ? { encryptedAttachment } : {}),
      });
      return res.data as Ticket;
    },
    onSuccess: (updatedTicket, variables) => {
      setCommentDraft(variables.ticketId, '');
      setCommentAttachments((prev) => ({ ...prev, [variables.ticketId]: null }));
      if (updatedTicket?.id) {
        upsertTicket(updatedTicket);
        void ensureTicketAttachmentsLoaded(updatedTicket);
        setActionErrors((prev) => ({ ...prev, [updatedTicket.id]: '' }));
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err: unknown, variables) => {
      const message = extractApiErrorMessage(err, 'Failed to post resolution note');
      setActionErrors((prev) => ({ ...prev, [variables.ticketId]: message }));
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tickets/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      removeTicket(deletedId);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err: unknown, variables) => {
      const message = extractApiErrorMessage(err, 'Failed to delete ticket');
      setActionErrors((prev) => ({ ...prev, [variables]: message }));
    },
  });

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace('/');
  };

  const handleSendFollowUpRequest = async (ticket: Ticket) => {
    setActionErrors((prev) => ({ ...prev, [ticket.id]: '' }));
    try {
      const cleanPrompt = sanitizeText(followUpPrompt);
      const followUpNote = cleanPrompt
        ? `[FOLLOW-UP REQUESTED] ${cleanPrompt}`
        : '[FOLLOW-UP REQUESTED] Additional information or screenshot requested by IT Support.';

      const encryptedAttachment = followUpAttachment
        ? await compressAndEncryptImageFile(followUpAttachment)
        : undefined;

      await updateTicketMutation.mutateAsync({
        id: ticket.id,
        payload: {
          status: 'NEEDS_INFO',
          amendmentNote: followUpNote,
          actorId: user?.id,
          ...(encryptedAttachment ? { encryptedAttachment } : {}),
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send follow-up request';
      setActionErrors((prev) => ({ ...prev, [ticket.id]: message }));
    }
  };

  const handlePostResolutionNote = async (ticketId: string, e: React.FormEvent) => {
    e.preventDefault();
    setActionErrors((prev) => ({ ...prev, [ticketId]: '' }));
    const text = sanitizeText(commentDrafts[ticketId] || '');
    const file = commentAttachments[ticketId] || null;

    if (!text && !file) return;

    try {
      const encryptedAttachment = file
        ? await compressAndEncryptImageFile(file)
        : undefined;
      await addCommentMutation.mutateAsync({
        ticketId,
        content: text || 'Attached reference screenshot.',
        encryptedAttachment,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to post resolution note';
      setActionErrors((prev) => ({ ...prev, [ticketId]: message }));
    }
  };

  // Counts & Subsets across sections
  const unassignedTickets = React.useMemo(
    () => tickets.filter((t) => !resolveTicketAssigneeId(t)),
    [tickets],
  );
  const allAssignedTickets = React.useMemo(
    () => tickets.filter((t) => Boolean(resolveTicketAssigneeId(t))),
    [tickets],
  );
  const myAssignedTickets = React.useMemo(
    () =>
      user?.id
        ? tickets.filter((t) => resolveTicketAssigneeId(t) === user.id)
        : [],
    [tickets, user?.id],
  );

  // Compute displayed tickets for the active section
  const displayedTickets = React.useMemo(() => {
    if (activeSection === 'DASHBOARD') {
      // On Dashboard Overview, show Unassigned Queue + Urgent/Breached active tickets for immediate triage
      return filterTickets(
        tickets.filter(
          (t) =>
            !resolveTicketAssigneeId(t) ||
            ((t.priority === 'URGENT' || t.priority === 'HIGH') &&
              t.status !== 'RESOLVED' &&
              t.status !== 'CLOSED'),
        ),
        'ALL',
        'ALL',
        searchQuery,
      );
    }

    if (activeSection === 'ASSIGNED_TICKETS') {
      const scoped = allAssignedTickets.filter((t) => {
        const assigneeId = resolveTicketAssigneeId(t);
        if (assignedScope === 'MINE') {
          return Boolean(user?.id && assigneeId === user.id);
        }
        if (assignedScope === 'ALL_ASSIGNED') {
          return true;
        }
        return assigneeId === assignedScope;
      });
      return filterTickets(scoped, statusFilter, priorityFilter, searchQuery);
    }

    // ALL_TICKETS section
    const assignmentScoped = tickets.filter((t) => {
      const hasAssignee = Boolean(resolveTicketAssigneeId(t));
      if (assignmentFilter === 'UNASSIGNED') return !hasAssignee;
      if (assignmentFilter === 'ASSIGNED') return hasAssignee;
      return true;
    });
    return filterTickets(assignmentScoped, statusFilter, priorityFilter, searchQuery);
  }, [
    activeSection,
    tickets,
    allAssignedTickets,
    assignedScope,
    assignmentFilter,
    statusFilter,
    priorityFilter,
    searchQuery,
    user?.id,
  ]);

  // Automatically load attachments once whenever a displayed ticket accordion is expanded (viewed)
  React.useEffect(() => {
    displayedTickets.forEach((ticket) => {
      if (expandedTicketIds[ticket.id]) {
        void ensureTicketAttachmentsLoaded(ticket);
      }
    });
  }, [displayedTickets, expandedTicketIds, ensureTicketAttachmentsLoaded]);

  const kpis = React.useMemo(() => computeTicketKpis(tickets), [tickets]);

  const allExpanded =
    displayedTickets.length > 0 &&
    displayedTickets.every((t) => Boolean(expandedTicketIds[t.id]));

  const handleToggleAllAccordions = () => {
    setAllTicketsExpanded(displayedTickets, !allExpanded);
  };

  if (!user && isVerifyingSession) {
    return <ContextualLoader context="admin-auth" />;
  }

  const renderAccordionTicketList = (
    list: Ticket[],
    emptyMessage: string,
  ) => {
    if (showInitialSkeleton) {
      return <ContextualLoader context="admin-queue" count={3} />;
    }

    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return list.map((ticket) => {
      const isExpanded = Boolean(expandedTicketIds[ticket.id]);
      const totalAttachments = countTicketAttachments(ticket);
      const commentCount = ticket.comments?.length || 0;
      const sla = computeTicketSlaStatus(ticket);
      const assigneeId = resolveTicketAssigneeId(ticket);
      const isTicketAssigned = Boolean(assigneeId);
      const isClosed = ticket.status === 'CLOSED';
      const isAdmin = user?.role === 'ADMIN';
      const isAssignedToMe = Boolean(user?.id && assigneeId === user.id);
      const isAssignedToOther = Boolean(assigneeId && user?.id && assigneeId !== user.id);
      const canManageTicket = isAdmin || isAssignedToMe;
      const initialAttachmentKey = `ticket:${ticket.id}`;
      const decryptedTicketImg = decryptedAttachments[initialAttachmentKey];
      const isLoadingTicketImg = Boolean(
        loadingAttachmentKeys[initialAttachmentKey],
      );
      const isTicketImgHidden = Boolean(
        hiddenAttachmentKeys[initialAttachmentKey],
      );
      const isFollowUpOpen = followUpTicketId === ticket.id;

      return (
        <Card
          key={ticket.id}
          className={`transition-colors ${
            ticket.status === 'NEEDS_INFO'
              ? 'border-amber-400/80 dark:border-amber-500/60'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {/* Accordion Summary Header */}
          <CardHeader className="p-0">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => toggleTicketExpanded(ticket.id)}
              className="w-full text-left p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-t-xl"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-slate-700 dark:text-slate-200' : ''
                    }`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {formatShortTicketId(ticket.id)}
                  </span>
                  <CardTitle className="text-base sm:text-lg font-bold truncate">
                    {ticket.title}
                  </CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Reported by{' '}
                    <strong className="font-semibold text-slate-700 dark:text-slate-300">
                      {ticket.creator?.fullName || 'Anonymous'}
                    </strong>{' '}
                    ({ticket.creator?.email || 'no-email'})
                  </span>
                  <span>•</span>
                  <span>{formatTicketDateTime(ticket.createdAt)}</span>
                  <span>•</span>
                  <span>
                    Assignee:{' '}
                    <strong
                      className={`font-medium ${
                        isTicketAssigned
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {ticket.assignee?.fullName || 'Unassigned'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-7 lg:pl-0 shrink-0">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                    sla.isBreached
                      ? 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30'
                      : sla.isResolved
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {sla.label}
                </span>
                {commentCount > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                    {commentCount} {commentCount === 1 ? 'message' : 'messages'}
                  </span>
                )}
                {totalAttachments > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 font-medium">
                    {totalAttachments} {totalAttachments === 1 ? 'attachment' : 'attachments'}
                  </span>
                )}
                <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                <Badge variant={getStatusBadgeVariant(ticket.status)}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            </button>
          </CardHeader>

          {/* Accordion Body */}
          {isExpanded && (
            <CardContent className="p-4 sm:p-5 pt-0 space-y-5 border-t border-slate-100 dark:border-slate-800/80">
              {/* 1. Admin / Agent Triage & Actions Bar */}
              {isClosed ? (
                /* Closed Ticket Banner (Immutable by staff, can only be reopened by customer) */
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Closed &amp; Archived
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      This ticket is closed. It cannot be modified by staff unless the customer reopens it from the portal.
                    </span>
                  </div>
                  {isAdmin && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteTicketMutation.mutate(ticket.id)}
                      className="h-8 text-xs shrink-0"
                    >
                      Delete Ticket
                    </Button>
                  )}
                </div>
              ) : !isTicketAssigned ? (
                /* Unassigned Active Ticket Bar */
                <div className="pt-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      Unassigned Ticket:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`priority-${ticket.id}`}
                        className="text-xs font-medium text-slate-500"
                      >
                        Priority:
                      </label>
                      <select
                        id={`priority-${ticket.id}`}
                        value={ticket.priority}
                        onChange={(e) =>
                          updateTicketMutation.mutate({
                            id: ticket.id,
                            payload: {
                              priority: e.target.value as Ticket['priority'],
                            },
                          })
                        }
                        className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>

                    {isAdmin ? (
                      /* Admin can delegate to any agent */
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={`assignee-${ticket.id}`}
                          className="text-xs font-medium text-slate-500"
                        >
                          Assignee:
                        </label>
                        <select
                          id={`assignee-${ticket.id}`}
                          value={resolveTicketAssigneeId(ticket)}
                          onChange={(e) => {
                            const nextAssignee = e.target.value || null;
                            updateTicketMutation.mutate({
                              id: ticket.id,
                              payload: {
                                assigneeId: nextAssignee,
                                ...(nextAssignee && ticket.status === 'OPEN'
                                  ? { status: 'IN_PROGRESS' as const }
                                  : {}),
                              },
                            });
                          }}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName} ({agent.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      /* Support Agent sees Unassigned status */
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <span>Assignee:</span>
                        <strong className="font-medium text-amber-600 dark:text-amber-400">
                          Unassigned
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {user && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() =>
                          updateTicketMutation.mutate({
                            id: ticket.id,
                            payload: {
                              assigneeId: user.id,
                              status:
                                ticket.status === 'OPEN'
                                  ? 'IN_PROGRESS'
                                  : ticket.status,
                            },
                          })
                        }
                        className="h-8 text-xs font-medium"
                      >
                        Claim &amp; Assign to Me
                      </Button>
                    )}

                    {isAdmin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTicketMutation.mutate(ticket.id)}
                        className="h-8 text-xs"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ) : isAssignedToOther && !isAdmin ? (
                /* Ticket assigned to another agent (read-only for non-admin agents with Take Over option) */
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-slate-500">
                      Assigned to:{' '}
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">
                        {ticket.assignee?.fullName || 'Another Agent'}
                      </strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      Status:{' '}
                      <Badge variant={getStatusBadgeVariant(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">
                      Priority:{' '}
                      <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateTicketMutation.mutate({
                          id: ticket.id,
                          payload: {
                            assigneeId: user!.id,
                          },
                        })
                      }
                      className="h-8 text-xs shrink-0"
                    >
                      Take Over &amp; Reassign to Me
                    </Button>
                  </div>
                </div>
              ) : (
                /* Assigned Active Ticket Bar (Managed by Assignee or Admin) */
                <div className="pt-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`status-${ticket.id}`}
                        className="text-xs font-medium text-slate-500"
                      >
                        Status:
                      </label>
                      <select
                        id={`status-${ticket.id}`}
                        value={ticket.status}
                        onChange={(e) =>
                          updateTicketMutation.mutate({
                            id: ticket.id,
                            payload: {
                              status: e.target.value as Ticket['status'],
                            },
                          })
                        }
                        className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="NEEDS_INFO">NEEDS_INFO</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`priority-${ticket.id}`}
                        className="text-xs font-medium text-slate-500"
                      >
                        Priority:
                      </label>
                      <select
                        id={`priority-${ticket.id}`}
                        value={ticket.priority}
                        onChange={(e) =>
                          updateTicketMutation.mutate({
                            id: ticket.id,
                            payload: {
                              priority: e.target.value as Ticket['priority'],
                            },
                          })
                        }
                        className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                        <option value="URGENT">URGENT</option>
                      </select>
                    </div>

                    {isAdmin ? (
                      /* Admin has full assignee selection across all agents */
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor={`assignee-${ticket.id}`}
                          className="text-xs font-medium text-slate-500"
                        >
                          Assignee:
                        </label>
                        <select
                          id={`assignee-${ticket.id}`}
                          value={resolveTicketAssigneeId(ticket)}
                          onChange={(e) => {
                            const nextAssignee = e.target.value || null;
                            updateTicketMutation.mutate({
                              id: ticket.id,
                              payload: {
                                assigneeId: nextAssignee,
                                ...(nextAssignee && ticket.status === 'OPEN'
                                  ? { status: 'IN_PROGRESS' as const }
                                  : {}),
                              },
                            });
                          }}
                          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="">Unassigned</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName} ({agent.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      /* Agent is assigned to this ticket: show their name and Unassign option */
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">Assignee:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {ticket.assignee?.fullName || 'Assigned to You'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateTicketMutation.mutate({
                              id: ticket.id,
                              payload: {
                                assigneeId: null,
                              },
                            })
                          }
                          className="h-7 px-2 text-[11px] text-slate-500 hover:text-red-500"
                        >
                          Unassign
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Follow-up composer trigger */}
                    <Button
                      type="button"
                      variant={isFollowUpOpen ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (isFollowUpOpen) {
                          closeFollowUpComposer();
                          setFollowUpAttachment(null);
                        } else {
                          openFollowUpComposer(ticket.id);
                          setFollowUpAttachment(null);
                        }
                      }}
                      className="h-8 text-xs"
                    >
                      {isFollowUpOpen
                        ? 'Cancel Follow-Up'
                        : 'Request Info / Follow-Up'}
                    </Button>

                    {isAdmin && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTicketMutation.mutate(ticket.id)}
                        className="h-8 text-xs"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {actionErrors[ticket.id] && (
                <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
                  {actionErrors[ticket.id]}
                </div>
              )}

              {/* Inline Follow-Up Request Composer */}
              {isTicketAssigned && !isClosed && canManageTicket && isFollowUpOpen && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                      Request Customer Follow-Up / Additional Info
                    </span>
                    <span className="text-[11px] text-amber-600/80 dark:text-amber-300/80">
                      Sets ticket status to NEEDS INFO
                    </span>
                  </div>

                  <textarea
                    rows={2}
                    value={followUpPrompt}
                    onChange={(e) => setFollowUpPrompt(e.target.value)}
                    placeholder="Describe what details, steps, or screenshot you need from the customer..."
                    className="flex w-full rounded-md border border-amber-500/30 bg-white dark:bg-slate-950 px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) =>
                          setFollowUpAttachment(e.target.files?.[0] || null)
                        }
                        className="text-xs h-8 max-w-xs cursor-pointer"
                      />
                      {followUpAttachment && (
                        <span className="text-[11px] text-slate-500">
                          ({formatByteSize(followUpAttachment.size)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          closeFollowUpComposer();
                          setFollowUpAttachment(null);
                        }}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateTicketMutation.isPending}
                        onClick={() => handleSendFollowUpRequest(ticket)}
                        className="h-8 text-xs"
                      >
                        {updateTicketMutation.isPending
                          ? 'Sending...'
                          : 'Send Follow-Up Request'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Initial Ticket Report Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Initial Ticket Report</span>
                  <span>Opened {formatTicketDateTime(ticket.createdAt)}</span>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 space-y-3">
                  <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </p>

                  {ticket.hasAttachment && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            Initial Attachment
                          </Badge>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ticket.attachmentName || 'attachment.png'}
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
                              toggleAttachmentVisibility(initialAttachmentKey)
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
                            className="max-h-80 rounded-md border border-slate-200 dark:border-slate-700 object-contain bg-slate-950/20 cursor-zoom-in hover:opacity-95 transition-opacity"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Chronological Activity & Follow-Up History Timeline */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Activity &amp; Follow-Up History ({commentCount})</span>
                  <span>Chronological Order</span>
                </div>

                {commentCount === 0 ? (
                  <p className="text-xs text-slate-500 italic py-1">
                    No follow-up requests, customer amendments, or resolution notes yet.
                  </p>
                ) : (
                  <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-3">
                    {ticket.comments!.map((comment) => {
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
                      const isFollowUpReq = parsed.kind === 'FOLLOW_UP';
                      const isCustomerAmend = parsed.kind === 'AMENDMENT';

                      return (
                        <div
                          key={comment.id}
                          className={`relative p-3 rounded-lg border text-xs space-y-2 ${
                            isFollowUpReq
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : isCustomerAmend
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : 'bg-slate-100/80 dark:bg-slate-900/90 border-slate-200/70 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {comment.author?.fullName || 'Support User'}
                              </span>
                              {comment.author?.role && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                  {comment.author.role}
                                </span>
                              )}
                              <Badge
                                variant={
                                  isFollowUpReq
                                    ? 'warning'
                                    : isCustomerAmend
                                      ? 'default'
                                      : 'secondary'
                                }
                                className="text-[10px] py-0 px-2"
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

                          {/* Per-Message Attachment inside the timeline entry (auto-loaded once when viewed) */}
                          {comment.hasAttachment && (
                            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    Attached Image
                                  </Badge>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {comment.attachmentName || 'attachment.png'}
                                  </span>
                                  {comment.attachmentOriginalSize && (
                                    <span className="text-slate-400">
                                      ({formatByteSize(comment.attachmentOriginalSize)})
                                    </span>
                                  )}
                                </div>
                                {decryptedCommentImg ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      toggleAttachmentVisibility(
                                        commentAttachmentKey,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  >
                                    {isCommentImgHidden
                                      ? 'Show Image'
                                      : 'Hide Image'}
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {isLoadingCommentImg
                                      ? 'Loading image...'
                                      : ''}
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
                                    className="max-h-80 rounded-md border border-slate-200 dark:border-slate-700 object-contain bg-slate-950/20 cursor-zoom-in hover:opacity-95 transition-opacity"
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

              {/* 4. Post IT Resolution Note Composer (visible once assigned, active, and manageable) */}
              {isTicketAssigned && !isClosed && canManageTicket && (
                <form
                  onSubmit={(e) => handlePostResolutionNote(ticket.id, e)}
                  className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Add an IT resolution note or update for the customer..."
                      value={commentDrafts[ticket.id] || ''}
                      onChange={(e) =>
                        setCommentDraft(ticket.id, e.target.value)
                      }
                      className="text-xs h-9 flex-1"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addCommentMutation.isPending}
                      className="h-9 text-xs shrink-0"
                    >
                      {addCommentMutation.isPending ? 'Posting...' : 'Post Note'}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        Attach image to note (optional):
                      </span>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) =>
                          setCommentAttachments((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.files?.[0] || null,
                          }))
                        }
                        className="text-xs h-8 max-w-xs cursor-pointer"
                      />
                      {commentAttachments[ticket.id] && (
                        <button
                          type="button"
                          onClick={() =>
                            setCommentAttachments((prev) => ({
                              ...prev,
                              [ticket.id]: null,
                            }))
                          }
                          className="text-[11px] text-red-500 hover:underline"
                        >
                          Remove (
                          {formatByteSize(commentAttachments[ticket.id]!.size)})
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}

              {/* Informative message for non-admin agents viewing someone else's active ticket */}
              {!isClosed && isAssignedToOther && !isAdmin && (
                <div className="p-3 rounded-md bg-slate-100/70 dark:bg-slate-900/50 text-xs text-slate-500 text-center border border-slate-200/50 dark:border-slate-800">
                  This ticket is currently assigned to{' '}
                  <strong className="text-slate-700 dark:text-slate-300">
                    {ticket.assignee?.fullName}
                  </strong>
                  . Click &quot;Take Over &amp; Reassign to Me&quot; above to post resolution notes or request customer info.
                </div>
              )}
            </CardContent>
          )}
        </Card>
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
              TicketSupport
            </span>
            <Badge variant="default">IT Admin &amp; Operations Console</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/portal">
              <Button variant="outline" size="sm">
                Customer Portal
              </Button>
            </Link>
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{user.fullName}</span>
                <Badge variant="secondary">{user.role}</Badge>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                IT Service Desk Console
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Monitor live SLA metrics, triage incoming unassigned tickets, and resolve assigned incidents.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {formattedLastUpdated && (
                <div
                  data-testid="dashboard-last-updated"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-xs text-slate-600 dark:text-slate-300"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isFetching ? 'bg-blue-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isFetching ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}
                    />
                  </span>
                  <span>
                    Last updated: <strong className="font-semibold">{formattedLastUpdated}</strong>
                  </span>
                </div>
              )}
              {updateTicketMutation.isPending && (
                <ContextualLoader context="triage-update" />
              )}
              {addCommentMutation.isPending && (
                <ContextualLoader context="comment-post" />
              )}
              {deleteTicketMutation.isPending && (
                <ContextualLoader context="ticket-delete" />
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {isFetching && hasLoadedTickets ? 'Syncing...' : 'Refresh Queue'}
              </Button>
            </div>
          </div>

          {/* Primary Navigation Sections (Zustand-backed) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={activeSection === 'DASHBOARD' ? 'default' : 'outline'}
                onClick={() => setActiveSection('DASHBOARD')}
                className="text-xs font-semibold"
              >
                Dashboard Overview
                {unassignedTickets.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
                    {unassignedTickets.length} unassigned
                  </span>
                )}
              </Button>

              <Button
                type="button"
                size="sm"
                variant={activeSection === 'ALL_TICKETS' ? 'default' : 'outline'}
                onClick={() => setActiveSection('ALL_TICKETS')}
                className="text-xs font-semibold"
              >
                All Tickets
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-500/20">
                  {tickets.length}
                </span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant={activeSection === 'ASSIGNED_TICKETS' ? 'default' : 'outline'}
                onClick={() => setActiveSection('ASSIGNED_TICKETS')}
                className="text-xs font-semibold"
              >
                Assigned Tickets
                <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-500/20 text-blue-400">
                  {myAssignedTickets.length} mine / {allAssignedTickets.length} total
                </span>
              </Button>
            </div>

            {displayedTickets.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAllAccordions}
                className="h-8 text-xs"
              >
                {allExpanded ? 'Collapse All Cards' : 'Expand All Cards'}
              </Button>
            )}
          </div>

          {/* ===================================================================
              SECTION 1: DASHBOARD OVERVIEW
             =================================================================== */}
          {activeSection === 'DASHBOARD' && (
            <div className="space-y-6">
              {showInitialSkeleton ? (
                <ContextualLoader context="admin-kpi" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card
                    onClick={() => {
                      setAssignmentFilter('ALL');
                      setActiveSection('ALL_TICKETS');
                    }}
                    className="cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase">
                        Total Tickets
                      </p>
                      <p className="text-2xl font-extrabold mt-1">{kpis.total}</p>
                    </CardContent>
                  </Card>

                  <Card
                    onClick={() => {
                      setAssignmentFilter('UNASSIGNED');
                      setActiveSection('ALL_TICKETS');
                    }}
                    className="cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-amber-500 uppercase">
                        Unassigned Queue
                      </p>
                      <p className="text-2xl font-extrabold mt-1">
                        {unassignedTickets.length}
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    onClick={() => {
                      setAssignedScope('MINE');
                      setActiveSection('ASSIGNED_TICKETS');
                    }}
                    className="cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-blue-500 uppercase">
                        Assigned to Me
                      </p>
                      <p className="text-2xl font-extrabold mt-1">
                        {myAssignedTickets.length}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-indigo-500 uppercase">
                        In Progress / Info
                      </p>
                      <p className="text-2xl font-extrabold mt-1">
                        {kpis.inProgress + kpis.needsInfo}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-red-500 uppercase">
                        Urgent / High
                      </p>
                      <p className="text-2xl font-extrabold mt-1">{kpis.urgentHigh}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium text-emerald-500 uppercase">
                        Resolved / Closed
                      </p>
                      <p className="text-2xl font-extrabold mt-1">
                        {kpis.resolvedClosed}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Support Team Workload Summary */}
              {agents.length > 0 && (
                <Card>
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      IT Support Team Workload
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAssignedScope('ALL_ASSIGNED');
                        setActiveSection('ASSIGNED_TICKETS');
                      }}
                      className="h-7 text-xs"
                    >
                      View All Assigned ({allAssignedTickets.length}) →
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {agents.map((agent) => {
                      const agentTickets = allAssignedTickets.filter(
                        (t) => resolveTicketAssigneeId(t) === agent.id,
                      );
                      const activeCount = agentTickets.filter(
                        (t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED',
                      ).length;
                      const resolvedCount = agentTickets.filter(
                        (t) => t.status === 'RESOLVED' || t.status === 'CLOSED',
                      ).length;

                      return (
                        <div
                          key={agent.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex items-center justify-between gap-2"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {agent.fullName}
                              </span>
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                {agent.role}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              <strong className="text-blue-500">{activeCount} active</strong> ·{' '}
                              <span className="text-emerald-500">{resolvedCount} resolved</span>
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssignedScope(
                                user?.id === agent.id ? 'MINE' : agent.id,
                              );
                              setActiveSection('ASSIGNED_TICKETS');
                            }}
                            className="h-7 text-xs shrink-0"
                          >
                            View Queue
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Immediate Triage Queue (Unassigned + Urgent Active Tickets) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Immediate Triage &amp; Unassigned Queue ({displayedTickets.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Unassigned customer tickets waiting to be claimed and high-priority active incidents.
                    </p>
                  </div>
                  <Input
                    placeholder="Quick search triage queue..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 text-xs h-8"
                  />
                </div>

                {renderAccordionTicketList(
                  displayedTickets,
                  'All incoming tickets are currently assigned and triaged! Switch to "Assigned Tickets" or "All Tickets" to view active work.',
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 2: ALL TICKETS
             =================================================================== */}
          {activeSection === 'ALL_TICKETS' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(['ALL', 'OPEN', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'] as const).map(
                        (status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={statusFilter === status ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(status)}
                            className="text-xs"
                          >
                            {status.replace('_', ' ')}
                          </Button>
                        ),
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: `All (${tickets.length})` },
                          {
                            id: 'UNASSIGNED',
                            label: `Unassigned (${unassignedTickets.length})`,
                          },
                          {
                            id: 'ASSIGNED',
                            label: `Assigned (${allAssignedTickets.length})`,
                          },
                        ] as const
                      ).map((tab) => (
                        <Button
                          key={tab.id}
                          type="button"
                          size="sm"
                          variant={assignmentFilter === tab.id ? 'secondary' : 'ghost'}
                          onClick={() => setAssignmentFilter(tab.id)}
                          className="h-8 text-xs"
                        >
                          {tab.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <select
                      aria-label="Filter by Priority"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="URGENT">Urgent Only</option>
                      <option value="HIGH">High Only</option>
                      <option value="MEDIUM">Medium Only</option>
                      <option value="LOW">Low Only</option>
                    </select>

                    <Input
                      placeholder="Search all tickets by #ID, title, description, or customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full sm:w-80 text-xs h-9"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {renderAccordionTicketList(
                  displayedTickets,
                  'No tickets match the current filter criteria.',
                )}
              </div>
            </div>
          )}

          {/* ===================================================================
              SECTION 3: ASSIGNED TICKETS
             =================================================================== */}
          {activeSection === 'ASSIGNED_TICKETS' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* Scope Switcher: Assigned to Me vs All Assigned vs Specific Engineer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={assignedScope === 'MINE' ? 'default' : 'outline'}
                        onClick={() => setAssignedScope('MINE')}
                        className="text-xs"
                      >
                        Assigned to Me ({myAssignedTickets.length})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={assignedScope === 'ALL_ASSIGNED' ? 'default' : 'outline'}
                        onClick={() => setAssignedScope('ALL_ASSIGNED')}
                        className="text-xs"
                      >
                        All Assigned Tickets ({allAssignedTickets.length})
                      </Button>
                      {agents
                        .filter((a) => a.id !== user?.id)
                        .map((agent) => {
                          const count = allAssignedTickets.filter(
                            (t) => resolveTicketAssigneeId(t) === agent.id,
                          ).length;
                          return (
                            <Button
                              key={agent.id}
                              type="button"
                              size="sm"
                              variant={assignedScope === agent.id ? 'default' : 'ghost'}
                              onClick={() => setAssignedScope(agent.id)}
                              className="text-xs"
                            >
                              {agent.fullName} ({count})
                            </Button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Status + Priority + Search */}
                  <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(['ALL', 'OPEN', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'] as const).map(
                        (status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={statusFilter === status ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(status)}
                            className="text-xs"
                          >
                            {status.replace('_', ' ')}
                          </Button>
                        ),
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                      <select
                        aria-label="Filter by Priority"
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="h-9 rounded-md border border-slate-200 bg-transparent px-3 py-1 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950"
                      >
                        <option value="ALL">All Priorities</option>
                        <option value="URGENT">Urgent Only</option>
                        <option value="HIGH">High Only</option>
                        <option value="MEDIUM">Medium Only</option>
                        <option value="LOW">Low Only</option>
                      </select>

                      <Input
                        placeholder="Search assigned tickets by #ID, title, or customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 text-xs h-9"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {renderAccordionTicketList(
                  displayedTickets,
                  assignedScope === 'MINE'
                    ? 'You do not have any tickets assigned to you matching these filters. Claim a ticket from Dashboard Overview or All Tickets!'
                    : 'No assigned tickets match the current filter criteria.',
                )}
              </div>
            </div>
          )}
        </div>
      </main>

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
