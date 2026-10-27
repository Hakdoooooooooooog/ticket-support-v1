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
  fetchAndDecryptTicketAttachment,
  formatByteSize,
  AuthUser,
  DecryptedAttachmentResult,
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
    setTickets,
    upsertTicket,
    removeTicket,
    clearTickets,
  } = useTicketsStore();
  const {
    agents: storedAgents,
    hasLoadedAgents,
    setAgents,
    statusFilter,
    priorityFilter,
    searchQuery,
    setStatusFilter,
    setPriorityFilter,
    setSearchQuery,
  } = useAdminStore();

  const [commentInputs, setCommentInputs] = React.useState<Record<string, string>>({});
  const [decryptedAttachments, setDecryptedAttachments] = React.useState<
    Record<string, DecryptedAttachmentResult>
  >({});
  const [loadingAttachmentIds, setLoadingAttachmentIds] = React.useState<
    Record<string, boolean>
  >({});

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
      };
    }) => {
      const res = await apiClient.patch(`/tickets/${id}`, payload);
      return res.data;
    },
    onSuccess: (updatedTicket) => {
      if (updatedTicket?.id) {
        upsertTicket(updatedTicket);
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({
      ticketId,
      content,
    }: {
      ticketId: string;
      content: string;
    }) => {
      const res = await apiClient.post(`/tickets/${ticketId}/comments`, {
        content,
        authorId: user?.id,
      });
      return res.data;
    },
    onSuccess: (updatedTicket, variables) => {
      setCommentInputs((prev) => ({ ...prev, [variables.ticketId]: '' }));
      if (updatedTicket?.id) {
        upsertTicket(updatedTicket);
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
  });

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace('/');
  };

  const filteredTickets = React.useMemo(
    () => filterTickets(tickets, statusFilter, priorityFilter, searchQuery),
    [tickets, statusFilter, priorityFilter, searchQuery],
  );

  const kpis = React.useMemo(() => computeTicketKpis(tickets), [tickets]);

  if (!user && isVerifyingSession) {
    return <ContextualLoader context="admin-auth" />;
  }

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
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                IT Service Desk Queue
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Triage incoming customer tickets, assign support engineers, update SLA priorities, and post resolution notes.
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

          {/* KPI Summary Cards */}
          {showInitialSkeleton ? (
            <ContextualLoader context="admin-kpi" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Total Tickets</p>
                  <p className="text-2xl font-extrabold mt-1">{kpis.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-amber-500 uppercase">Open Queue</p>
                  <p className="text-2xl font-extrabold mt-1">{kpis.open}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-blue-500 uppercase">In Progress</p>
                  <p className="text-2xl font-extrabold mt-1">{kpis.inProgress}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-red-500 uppercase">Urgent / High</p>
                  <p className="text-2xl font-extrabold mt-1">{kpis.urgentHigh}</p>
                </CardContent>
              </Card>
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-emerald-500 uppercase">Resolved / Closed</p>
                  <p className="text-2xl font-extrabold mt-1">{kpis.resolvedClosed}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter & Search Toolbar */}
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(['ALL', 'OPEN', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'] as const).map((status) => (
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
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
                  placeholder="Search by #ID, title, description, or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-72 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ticket Triage List */}
          <div className="space-y-4">
            {showInitialSkeleton && <ContextualLoader context="admin-queue" count={3} />}

            {!showInitialSkeleton && filteredTickets.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-slate-500">
                  No tickets match the current filter criteria.
                </CardContent>
              </Card>
            )}

            {!showInitialSkeleton &&
              filteredTickets.map((ticket) => (
                <Card key={ticket.id} className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">
                            {formatShortTicketId(ticket.id)}
                          </span>
                          <CardTitle className="text-lg font-bold">
                            {ticket.title}
                          </CardTitle>
                          <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(ticket.status)}>
                            {ticket.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          Reported by{' '}
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {ticket.creator?.fullName || 'Anonymous'}
                          </span>{' '}
                          ({ticket.creator?.email || 'no-email'}) on{' '}
                          {formatTicketDateTime(ticket.createdAt)}
                        </p>
                      </div>

                      {/* Admin Triage Controls */}
                      <div className="flex flex-wrap items-center gap-2">
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
                            className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
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
                            className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                          >
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="URGENT">URGENT</option>
                          </select>
                        </div>

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
                            onChange={(e) =>
                              updateTicketMutation.mutate({
                                id: ticket.id,
                                payload: {
                                  assigneeId: e.target.value || null,
                                },
                              })
                            }
                            className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                          >
                            <option value="">Unassigned</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.fullName} ({agent.role})
                              </option>
                            ))}
                          </select>
                        </div>

                        {user && ticket.assigneeId !== user.id && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateTicketMutation.mutate({
                                id: ticket.id,
                                payload: {
                                  assigneeId: user.id,
                                  status:
                                    ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
                                },
                              })
                            }
                            className="h-8 text-xs"
                          >
                            Assign to Me
                          </Button>
                        )}

                        {ticket.status !== 'NEEDS_INFO' && ticket.status !== 'CLOSED' && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const customPrompt = commentInputs[ticket.id]?.trim();
                              const followUpNote = customPrompt
                                ? `[FOLLOW-UP REQUESTED] ${customPrompt}`
                                : '[FOLLOW-UP REQUESTED] Additional information or screenshot requested by IT Support.';
                              updateTicketMutation.mutate({
                                id: ticket.id,
                                payload: {
                                  status: 'NEEDS_INFO',
                                  amendmentNote: followUpNote,
                                  actorId: user?.id,
                                },
                              });
                              if (customPrompt) {
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [ticket.id]: '',
                                }));
                              }
                            }}
                            className="h-8 text-xs"
                          >
                            Request Info / Follow-Up
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTicketMutation.mutate(ticket.id)}
                          className="h-8 text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-4">
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                      {ticket.description}
                    </p>

                    {ticket.hasAttachment && (
                      <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
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
                            disabled={Boolean(loadingAttachmentIds[ticket.id])}
                            onClick={() => handleToggleAttachment(ticket.id)}
                            className="h-7 text-xs"
                          >
                            {loadingAttachmentIds[ticket.id]
                              ? 'Loading...'
                              : decryptedAttachments[ticket.id]
                                ? 'Hide Attachment'
                                : 'View Attachment'}
                          </Button>
                        </div>

                        {decryptedAttachments[ticket.id] && (
                          <div className="pt-1 space-y-1.5">
                            <img
                              src={decryptedAttachments[ticket.id].dataUrl}
                              alt={decryptedAttachments[ticket.id].fileName}
                              className="max-h-72 rounded-md border border-slate-200 dark:border-slate-700 object-contain"
                            />
                           
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comments & Resolution Notes */}
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        IT Resolution Notes &amp; Activity ({ticket.comments?.length || 0})
                      </p>

                      {ticket.comments && ticket.comments.length > 0 && (
                        <div className="space-y-1.5">
                          {ticket.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="text-xs p-2.5 rounded-md bg-slate-100/80 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 flex items-start justify-between gap-2"
                            >
                              <div>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {comment.author?.fullName || 'IT Engineer'}:{' '}
                                </span>
                                <span className="text-slate-700 dark:text-slate-300">
                                  {comment.content}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {formatCommentTime(comment.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const text = commentInputs[ticket.id]?.trim();
                          if (!text) return;
                          addCommentMutation.mutate({
                            ticketId: ticket.id,
                            content: text,
                          });
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          placeholder="Add an IT resolution note or update for the customer..."
                          value={commentInputs[ticket.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [ticket.id]: e.target.value,
                            }))
                          }
                          className="text-xs h-8"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={addCommentMutation.isPending}
                          className="h-8 text-xs shrink-0"
                        >
                          Post Note
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
