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
import { APP_VERSION } from '@lib/constants';
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
  getUserInitial,
  getUserDisplayName,
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
import { NotificationCenter } from '@components/notification-center';
import { ThemeToggle } from '@components/theme-toggle';
import { CannedResponsesMenu } from '@components/canned-responses-menu';
import { useRealtimeEvents } from '@hooks/use-realtime-events';
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
    setTicketExpanded,
    setAllTicketsExpanded,
    viewedTicketIds,
    markTicketViewed,
    markTicketUnviewed,
    markAllTicketsViewed,
    expandedCommentHistories,
    highlightedTicketId,
    toggleCommentHistory,
    highlightTicket,
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
  const [realtimeAlert, setRealtimeAlert] = React.useState<string | null>(null);

  const { status: realtimeStatus } = useRealtimeEvents({
    onTicketCreated: (payload) => {
      setRealtimeAlert(
        `New Ticket #${payload.id?.slice(-6) || ''}: "${payload.title?.slice(0, 32) || 'Incident'}" received for triage`,
      );
    },
    onCommentAdded: (payload) => {
      if (payload.kind === 'AMENDMENT') {
        setRealtimeAlert(
          `Customer updated ticket #${payload.ticketId?.slice(-6) || ''}`,
        );
      }
    },
  });

  React.useEffect(() => {
    if (!realtimeAlert) return;
    const timer = setTimeout(() => setRealtimeAlert(null), 8000);
    return () => clearTimeout(timer);
  }, [realtimeAlert]);
  const [followUpAttachment, setFollowUpAttachment] = React.useState<File | null>(null);
  const [actionErrors, setActionErrors] = React.useState<Record<string, string>>({});

  // Responsive mobile navigation drawer & bottom sheet quick actions
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isQuickActionSheetOpen, setIsQuickActionSheetOpen] = React.useState(false);

  // Team Management subtab state
  const [teamManagementSubtab, setTeamManagementSubtab] = React.useState<
    'MEMBERS' | 'INVITE' | 'PROVISION'
  >('MEMBERS');

  // Staff Invitation states
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<'AGENT' | 'ADMIN'>('AGENT');
  const [generatedInviteCode, setGeneratedInviteCode] = React.useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = React.useState<string | null>(null);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Direct Staff Provisioning states
  const [provisionFullName, setProvisionFullName] = React.useState('');
  const [provisionEmail, setProvisionEmail] = React.useState('');
  const [provisionPassword, setProvisionPassword] = React.useState('');
  const [provisionRole, setProvisionRole] = React.useState<'AGENT' | 'ADMIN'>('AGENT');
  const [provisionSuccessMessage, setProvisionSuccessMessage] = React.useState<string | null>(null);
  const [provisionError, setProvisionError] = React.useState<string | null>(null);

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
    refetchInterval: 60 * 1000,
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

  const { data: queriedAgents, refetch: refetchAgents } = useQuery<AuthUser[]>({
    queryKey: ['agents'],
    initialData: hasLoadedAgents ? storedAgents : undefined,
    refetchOnWindowFocus: 'always',
    refetchInterval: 60 * 1000,
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

  // Staff Invitations Query (Administrators only)
  const { data: invites = [], refetch: refetchInvites } = useQuery<
    Array<{
      id: string;
      email: string;
      role: 'AGENT' | 'ADMIN';
      code: string;
      accepted: boolean;
      acceptedAt: string | null;
      createdAt: string;
      expiresAt: string;
      createdBy?: { fullName: string };
    }>
  >({
    queryKey: ['admin-invites'],
    enabled: user?.role === 'ADMIN',
    queryFn: async () => {
      try {
        const res = await apiClient.get('/auth/admin/invites');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async (payload: { email: string; role: 'AGENT' | 'ADMIN' }) => {
      const res = await apiClient.post('/auth/admin/invites', payload);
      return res.data;
    },
    onSuccess: (data) => {
      refetchInvites();
      setGeneratedInviteCode(data.code);
      setInviteSuccessMessage(`Invitation link generated for ${data.email}!`);
      setInviteError(null);
      setInviteEmail('');
    },
    onError: (err) => {
      setInviteError(extractApiErrorMessage(err, 'Failed to create staff invitation'));
      setInviteSuccessMessage(null);
    },
  });

  const adminCreateUserMutation = useMutation({
    mutationFn: async (payload: {
      fullName: string;
      email: string;
      password: string;
      role: 'AGENT' | 'ADMIN';
    }) => {
      const res = await apiClient.post('/auth/admin/users', payload);
      return res.data;
    },
    onSuccess: () => {
      refetchAgents();
      setProvisionSuccessMessage('Staff account created and active!');
      setProvisionError(null);
      setProvisionFullName('');
      setProvisionEmail('');
      setProvisionPassword('');
    },
    onError: (err) => {
      setProvisionError(extractApiErrorMessage(err, 'Failed to provision staff member'));
      setProvisionSuccessMessage(null);
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/auth/admin/invites/${id}`);
    },
    onSuccess: () => {
      refetchInvites();
    },
  });

  const handleCopyInviteLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}?invite=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSignOut = () => {
    clearSession();
    clearTickets();
    router.replace('/');
  };

  const handleSelectTicket = React.useCallback(
    (ticketId: string) => {
      setActiveSection('ALL_TICKETS');
      setAssignmentFilter('ALL');
      setStatusFilter('ALL');
      setPriorityFilter('ALL');
      setSearchQuery('');
      highlightTicket(ticketId);
    },
    [
      highlightTicket,
      setActiveSection,
      setAssignmentFilter,
      setStatusFilter,
      setPriorityFilter,
      setSearchQuery,
    ],
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetTicketId = params.get('ticketId');
    if (targetTicketId) {
      const timer = setTimeout(() => {
        handleSelectTicket(targetTicketId);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [handleSelectTicket]);

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
        <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/40">
          <CardContent className="p-8 text-center text-sm text-spruce-500">
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
      const isViewed = Boolean(viewedTicketIds[ticket.id]);

      return (
        <Card
          key={ticket.id}
          id={`ticket-${ticket.id}`}
          className={`overflow-hidden transition-all duration-150 ${
            ticket.status === 'NEEDS_INFO'
              ? isViewed
                ? 'border-amber-400/60 dark:border-amber-500/50 border-l-4 border-l-amber-400 dark:border-l-amber-500 bg-amber-500/5'
                : 'border-amber-400 dark:border-amber-500 border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-500/10 shadow-sm'
              : !isViewed
              ? 'border-spruce-300 dark:border-spruce-700/80 border-l-4 border-l-spruce-600 dark:border-l-spruce-300 bg-white dark:bg-spruce-900/85 shadow-sm hover:border-spruce-400 dark:hover:border-spruce-600'
              : 'border-spruce-200/90 dark:border-spruce-800/80 border-l-4 border-l-spruce-200/70 dark:border-l-spruce-800/80 bg-white/70 dark:bg-spruce-950/50 hover:bg-white dark:hover:bg-spruce-900/60'
          } ${
            highlightedTicketId === ticket.id
              ? 'ring-2 ring-spruce-400 shadow-xl shadow-spruce-500/20 dark:ring-spruce-300'
              : ''
          }`}
        >
          {/* Accordion Summary Header */}
          <CardHeader className="p-0">
            <div className="w-full p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-t-xl hover:bg-spruce-50/50 dark:hover:bg-spruce-900/40 transition-colors">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleTicketExpanded(ticket.id)}
                className="space-y-1.5 min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 rounded-lg group"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-spruce-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-90 text-spruce-800 dark:text-spruce-200' : ''
                    }`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  <span className="text-xs font-mono text-spruce-400 dark:text-spruce-400">
                    {formatShortTicketId(ticket.id)}
                  </span>

                  {/* New vs Viewed Color Badge Variant */}
                  {!isViewed ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-spruce-100 text-spruce-800 border border-spruce-300 dark:bg-spruce-300/15 dark:text-spruce-300 dark:border-spruce-400/40 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-spruce-600 dark:bg-spruce-300 animate-pulse" />
                      New
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-spruce-500 dark:text-spruce-400 bg-spruce-100/50 dark:bg-spruce-900/40 border border-spruce-200/60 dark:border-spruce-800/60">
                      <svg className="w-3 h-3 text-spruce-400 dark:text-spruce-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Viewed
                    </span>
                  )}

                  <CardTitle
                    className={`text-base sm:text-lg truncate group-hover:text-spruce-600 dark:group-hover:text-spruce-200 transition-colors ${
                      !isViewed
                        ? 'font-bold text-spruce-950 dark:text-white'
                        : 'font-medium text-spruce-800 dark:text-spruce-300'
                    }`}
                  >
                    {ticket.title}
                  </CardTitle>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-7 text-xs text-spruce-500 dark:text-spruce-400">
                  <span>
                    Reported by{' '}
                    <strong className="font-semibold text-spruce-700 dark:text-spruce-300">
                      {ticket.creator?.fullName || 'Anonymous'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>{formatTicketDateTime(ticket.createdAt)}</span>
                  <span>•</span>
                  <span>
                    Assignee:{' '}
                    <strong
                      className={`font-medium ${
                        isTicketAssigned
                          ? 'text-spruce-700 dark:text-spruce-300'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {ticket.assignee?.fullName || 'Unassigned'}
                    </strong>
                  </span>
                  {commentCount > 0 && (
                    <>
                      <span>•</span>
                      <span>
                        {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
                      </span>
                    </>
                  )}
                  {totalAttachments > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-spruce-700 dark:text-spruce-300 font-medium">
                        {totalAttachments} {totalAttachments === 1 ? 'attachment' : 'attachments'}
                      </span>
                    </>
                  )}
                  {sla.label && (
                    <>
                      <span>•</span>
                      <span
                        className={
                          sla.isBreached
                            ? 'text-red-500 font-semibold'
                            : sla.isResolved
                            ? 'text-emerald-500 font-medium'
                            : 'text-spruce-500'
                        }
                      >
                        SLA: {sla.label}
                      </span>
                    </>
                  )}
                  {typeof ticket.csatRating === 'number' && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-500 font-medium">
                        CSAT {ticket.csatRating}.0
                      </span>
                    </>
                  )}
                </div>
              </button>

              <div className="flex items-center gap-2 pl-7 lg:pl-0 shrink-0">
                <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                <Badge variant={getStatusBadgeVariant(ticket.status)}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
                <button
                  type="button"
                  onClick={() => {
                    if (isViewed) {
                      markTicketUnviewed(ticket.id);
                    } else {
                      markTicketViewed(ticket.id);
                    }
                  }}
                  title={isViewed ? 'Mark ticket as new / unviewed' : 'Mark ticket as viewed'}
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
          </CardHeader>

          {/* Accordion Body */}
          {isExpanded && (
            <CardContent className="p-4 sm:p-5 pt-0 space-y-5 border-t border-spruce-100 dark:border-spruce-800/80">
              {/* 1. Admin / Agent Triage & Actions Bar */}
              {isClosed ? (
                /* Closed Ticket Banner (Immutable by staff, can only be reopened by customer) */
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Closed &amp; Archived
                    </span>
                    <span className="text-spruce-600 dark:text-spruce-300">
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
                        className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
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
                        className="h-8 rounded-md border border-spruce-300 bg-white px-2.5 text-xs font-medium text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
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
                          className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
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
                          className="h-8 rounded-md border border-spruce-300 bg-white px-2.5 text-xs font-medium text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
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
                      <div className="flex items-center gap-1.5 text-spruce-600 dark:text-spruce-300">
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
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-spruce-50/90 dark:bg-spruce-900/60 border border-spruce-200/70 dark:border-spruce-800">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-spruce-600 dark:text-spruce-300">
                      Assigned to:{' '}
                      <strong className="font-semibold text-spruce-900 dark:text-spruce-100">
                        {ticket.assignee?.fullName || 'Another Agent'}
                      </strong>
                    </span>
                    <span className="text-spruce-400 dark:text-spruce-600">•</span>
                    <span className="text-spruce-600 dark:text-spruce-300">
                      Status:{' '}
                      <strong className="text-spruce-900 dark:text-spruce-100">
                        {ticket.status.replace('_', ' ')}
                      </strong>
                    </span>
                    <span className="text-spruce-400 dark:text-spruce-600">•</span>
                    <span className="text-spruce-600 dark:text-spruce-300">
                      Priority:{' '}
                      <strong className="text-spruce-900 dark:text-spruce-100">
                        {ticket.priority}
                      </strong>
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
                <div className="pt-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3 rounded-lg bg-spruce-50/90 dark:bg-spruce-900/60 border border-spruce-200/70 dark:border-spruce-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`status-${ticket.id}`}
                        className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
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
                        className="h-8 rounded-md border border-spruce-300 bg-white px-2.5 text-xs font-medium text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
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
                        className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
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
                        className="h-8 rounded-md border border-spruce-300 bg-white px-2.5 text-xs font-medium text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
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
                          className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
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
                          className="h-8 rounded-md border border-spruce-300 bg-white px-2.5 text-xs font-medium text-spruce-900 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
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
                        <span className="font-semibold text-spruce-700 dark:text-spruce-300">Assignee:</span>
                        <span className="font-medium text-spruce-800 dark:text-spruce-200">
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
                          className="h-7 px-2 text-[11px] text-spruce-500 hover:text-red-500"
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                      Request Customer Follow-Up / Additional Info
                    </span>
                    <div className="flex items-center gap-2">
                      <CannedResponsesMenu
                        buttonLabel="Quick Templates"
                        onSelect={(snippet) =>
                          setFollowUpPrompt(
                            followUpPrompt ? `${followUpPrompt} ${snippet}` : snippet,
                          )
                        }
                      />
                      <span className="text-[11px] text-amber-600/80 dark:text-amber-300/80">
                        Sets status to NEEDS INFO
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={followUpPrompt}
                    onChange={(e) => setFollowUpPrompt(e.target.value)}
                    placeholder="Describe what details, steps, or screenshot you need from the customer..."
                    className="flex w-full rounded-md border border-amber-500/40 bg-white dark:bg-spruce-950 px-3 py-2 text-xs shadow-sm text-spruce-900 dark:text-spruce-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
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
                        <span className="text-[11px] text-spruce-500">
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

              {/* Customer Satisfaction Feedback Section */}
              {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
                typeof ticket.csatRating === 'number' ? (
                  <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-500 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          CSAT Score {ticket.csatRating}.0 / 5.0
                        </span>
                        <span className="font-semibold text-spruce-800 dark:text-spruce-200">
                          {ticket.csatRating === 5
                            ? 'Exceptional Resolution'
                            : ticket.csatRating === 4
                              ? 'Satisfied'
                              : ticket.csatRating === 3
                                ? 'Neutral'
                                : 'Dissatisfied'}
                        </span>
                      </div>
                      {ticket.csatRatedAt && (
                        <span className="text-[10px] text-spruce-500">
                          Rated on {formatTicketDateTime(ticket.csatRatedAt)}
                        </span>
                      )}
                    </div>
                    {ticket.csatComment && (
                      <p className="text-spruce-700 dark:text-spruce-300 italic bg-white/60 dark:bg-spruce-900/60 p-2.5 rounded border border-amber-500/10">
                        &ldquo;{ticket.csatComment}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-spruce-300 dark:border-spruce-700/60 bg-spruce-50/50 dark:bg-spruce-900/30 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-spruce-500 dark:text-spruce-400">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        CSAT Pending
                      </span>
                      <span className="text-spruce-600 dark:text-spruce-400">
                        Awaiting feedback from customer ({ticket.creator?.fullName || 'Customer'})
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-spruce-200 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-400">
                      Pending Rating
                    </span>
                  </div>
                )
              )}

              {/* 2. Initial Ticket Report Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-spruce-500 dark:text-spruce-400">
                  <span>Initial Ticket Report</span>
                  <span>Opened {formatTicketDateTime(ticket.createdAt)}</span>
                </div>

                <div className="p-3.5 rounded-lg bg-spruce-50/80 dark:bg-spruce-900/60 border border-spruce-200/70 dark:border-spruce-800 space-y-3">
                  <p className="text-sm text-spruce-800 dark:text-spruce-200 whitespace-pre-wrap leading-relaxed">
                    {ticket.description}
                  </p>

                  {ticket.hasAttachment && (
                    <div className="pt-2 border-t border-spruce-200/70 dark:border-spruce-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-spruce-900 dark:text-spruce-200">
                            {ticket.attachmentName || 'attachment.png'}
                          </span>
                          {ticket.attachmentOriginalSize && (
                            <span className="text-spruce-500 dark:text-spruce-400">
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
                          <span className="text-[11px] text-spruce-400">
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
                            className="max-h-80 rounded-md border border-spruce-200 dark:border-spruce-700 object-contain bg-spruce-950/20 cursor-zoom-in hover:opacity-95 transition-opacity"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Chronological Activity & Follow-Up History Timeline */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-spruce-500 dark:text-spruce-400">
                  <span>Activity &amp; Follow-Up History ({commentCount})</span>
                  <span>Chronological Order</span>
                </div>

                {commentCount === 0 ? (
                  <p className="text-xs text-spruce-500 italic py-1">
                    No follow-up requests, customer amendments, or resolution notes yet.
                  </p>
                ) : (() => {
                  const comments = ticket.comments || [];
                  const hasMultiple = comments.length > 1;
                  const isHistoryExpanded = Boolean(expandedCommentHistories[ticket.id]);
                  const earlierComments = hasMultiple ? comments.slice(0, -1) : [];
                  const latestComment = comments[comments.length - 1];

                  const renderAdminComment = (comment: typeof comments[0], isLatest = false) => {
                    const parsed = parseTimelineComment(comment.content);
                    const commentAttachmentKey = `comment:${comment.id}`;
                    const decryptedCommentImg = decryptedAttachments[commentAttachmentKey];
                    const isLoadingCommentImg = Boolean(loadingAttachmentKeys[commentAttachmentKey]);
                    const isCommentImgHidden = Boolean(hiddenAttachmentKeys[commentAttachmentKey]);
                    const isFollowUpReq = parsed.kind === 'FOLLOW_UP';
                    const isCustomerAmend = parsed.kind === 'AMENDMENT';

                    return (
                      <div
                        key={comment.id}
                        className={`relative p-3 rounded-lg border text-xs space-y-2 ${
                          isFollowUpReq
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : isCustomerAmend
                              ? 'bg-spruce-100/80 dark:bg-spruce-900/80 border-spruce-300 dark:border-spruce-700'
                              : 'bg-spruce-50/90 dark:bg-spruce-900/90 border-spruce-200/70 dark:border-spruce-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-spruce-900 dark:text-white">
                              {comment.author?.fullName || 'Support User'}
                            </span>
                            {comment.author?.role && (
                              <span className="text-[11px] text-spruce-500 dark:text-spruce-400 font-normal">
                                ({comment.author.role.toLowerCase()})
                              </span>
                            )}
                            {isFollowUpReq ? (
                              <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                                Follow-Up
                              </Badge>
                            ) : isCustomerAmend ? (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5">
                                Amendment
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-spruce-500 dark:text-spruce-400">
                            {formatCommentTime(comment.createdAt)}
                          </span>
                        </div>

                        <p className="text-spruce-800 dark:text-spruce-200 whitespace-pre-wrap leading-relaxed">
                          {parsed.cleanText}
                        </p>

                        {/* Per-Message Attachment inside the timeline entry */}
                        {comment.hasAttachment && (
                          <div className="pt-2 border-t border-spruce-200/60 dark:border-spruce-800/80 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-spruce-900 dark:text-spruce-200">
                                  {comment.attachmentName || 'attachment.png'}
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
                                  onClick={() =>
                                    toggleAttachmentVisibility(commentAttachmentKey)
                                  }
                                  className="h-7 text-xs"
                                >
                                  {isCommentImgHidden
                                    ? 'Show Image'
                                    : 'Hide Image'}
                                </Button>
                              ) : (
                                <span className="text-[11px] text-spruce-400">
                                  {isLoadingCommentImg
                                    ? 'Loading image...'
                                    : ''}
                                </span>
                              )}
                            </div>

                            {decryptedCommentImg && !isCommentImgHidden && (
                              <div className="pt-1 max-w-full overflow-hidden">
                                <img
                                  src={decryptedCommentImg.dataUrl}
                                  alt={decryptedCommentImg.fileName}
                                  onClick={() =>
                                    setLightboxImage(decryptedCommentImg)
                                  }
                                  title="Click to inspect full-size image"
                                  className="max-h-48 sm:max-h-56 max-w-full rounded-md border border-spruce-200 dark:border-spruce-700 object-contain bg-spruce-950/20 cursor-zoom-in hover:opacity-95 transition-opacity"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="relative pl-4 border-l-2 border-spruce-200 dark:border-spruce-800 space-y-3">
                      {hasMultiple && (
                        <div className="pb-1">
                          <button
                            type="button"
                            onClick={() => toggleCommentHistory(ticket.id)}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-spruce-200 dark:border-spruce-800 bg-spruce-100/70 dark:bg-spruce-900/60 hover:bg-spruce-200/60 dark:hover:bg-spruce-800/80 text-xs text-spruce-700 dark:text-spruce-300 font-medium transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-spruce-600 dark:text-spruce-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              <span>
                                {isHistoryExpanded
                                  ? `Showing entire thread (${comments.length} messages)`
                                  : `Show ${earlierComments.length} earlier ${
                                      earlierComments.length === 1 ? 'reply' : 'replies'
                                    }`}
                              </span>
                            </span>
                            <span className="text-[11px] text-spruce-700 dark:text-spruce-300 font-semibold hover:underline">
                              {isHistoryExpanded ? 'Collapse thread \u2191' : 'Expand thread \u2193'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Earlier comments shown when expanded */}
                      {hasMultiple && isHistoryExpanded && (
                        <div className="space-y-3">
                          {earlierComments.map((c) => renderAdminComment(c, false))}
                        </div>
                      )}

                      {/* Latest comment always visible */}
                      {latestComment && renderAdminComment(latestComment, true)}
                    </div>
                  );
                })()}
              </div>

              {/* 4. Post IT Resolution Note Composer (visible once assigned, active, and manageable) */}
              {isTicketAssigned && !isClosed && canManageTicket && (
                <form
                  onSubmit={(e) => handlePostResolutionNote(ticket.id, e)}
                  className="pt-2 border-t border-spruce-100 dark:border-spruce-800/80 space-y-2.5"
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
                      <span className="text-[11px] text-spruce-500">
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

                    <CannedResponsesMenu
                      buttonLabel="Canned Responses"
                      direction="up"
                      align="right"
                      onSelect={(snippet) =>
                        setCommentDraft(
                          ticket.id,
                          commentDrafts[ticket.id]
                            ? `${commentDrafts[ticket.id]} ${snippet}`
                            : snippet,
                        )
                      }
                    />
                  </div>
                </form>
              )}

              {/* Informative message for non-admin agents viewing someone else's active ticket */}
              {!isClosed && isAssignedToOther && !isAdmin && (
                <div className="p-3 rounded-md bg-spruce-100/70 dark:bg-spruce-900/50 text-xs text-spruce-600 dark:text-spruce-400 text-center border border-spruce-200/50 dark:border-spruce-800">
                  This ticket is currently assigned to{' '}
                  <strong className="text-spruce-800 dark:text-spruce-200">
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-spruce-50 text-spruce-950 dark:bg-spruce-950 dark:text-spruce-50 transition-colors">
      {/* -------------------------------------------------------------
          1. DESKTOP SIDEBAR (lg:flex, w-64, fixed on left)
         ------------------------------------------------------------- */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-950 z-20 select-none shadow-sm">
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-spruce-200 dark:border-spruce-800 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-xs shadow-sm shrink-0">
              TS
            </div>
            <span className="font-extrabold text-base tracking-tight text-spruce-900 dark:text-white truncate">
              TicketSupport
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-spruce-100 text-spruce-800 dark:bg-spruce-800/80 dark:text-spruce-300 border border-spruce-300/60 dark:border-spruce-700 whitespace-nowrap shrink-0">
            IT Console
          </span>
        </div>

        {/* Current Staff User Profile Card */}
        {user && (
          <div className="p-4 border-b border-spruce-200 dark:border-spruce-800 bg-spruce-50/70 dark:bg-spruce-900/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-300 font-bold flex items-center justify-center shrink-0 border border-spruce-300 dark:border-spruce-700 text-xs">
                  {getUserInitial(user)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs truncate text-spruce-900 dark:text-white">
                    {getUserDisplayName(user)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {user.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Routes */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => setActiveSection('DASHBOARD')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'DASHBOARD'
                ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
                : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
            }`}
          >
            <span>Dashboard Overview</span>
            {unassignedTickets.length > 0 && (
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  activeSection === 'DASHBOARD'
                    ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                    : 'bg-amber-500/20 text-amber-500'
                }`}
              >
                {unassignedTickets.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ALL_TICKETS')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'ALL_TICKETS'
                ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
                : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
            }`}
          >
            <span>All Tickets</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                activeSection === 'ALL_TICKETS'
                  ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                  : 'bg-spruce-200 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300'
              }`}
            >
              {tickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('ASSIGNED_TICKETS')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'ASSIGNED_TICKETS'
                ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
                : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
            }`}
          >
            <span>Assigned Tickets</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                activeSection === 'ASSIGNED_TICKETS'
                  ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                  : 'bg-spruce-100 text-spruce-800 dark:bg-spruce-700 dark:text-spruce-200'
              }`}
            >
              {myAssignedTickets.length}
            </span>
          </button>

          {/* Admin Exclusive: IT Support Team & Staff Invites */}
          {user?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setActiveSection('TEAM_MANAGEMENT')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                activeSection === 'TEAM_MANAGEMENT'
                  ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950 shadow-sm'
                  : 'text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900'
              }`}
            >
              <span>Team &amp; Invites</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold uppercase tracking-wider ${
                  activeSection === 'TEAM_MANAGEMENT'
                    ? 'bg-white/20 text-white dark:bg-spruce-950/20 dark:text-spruce-950'
                    : 'bg-emerald-500/20 text-emerald-500'
                }`}
              >
                Admin
              </span>
            </button>
          )}

          <div className="pt-3 border-t border-spruce-200 dark:border-spruce-800">
            <Link
              href="/portal"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-spruce-700 hover:text-spruce-950 hover:bg-spruce-100 dark:text-spruce-300 dark:hover:text-white dark:hover:bg-spruce-900 transition-colors"
            >
              <span>Customer Portal</span>
              <span className="text-[10px] font-bold text-spruce-400 uppercase tracking-wider">
                Portal
              </span>
            </Link>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 pb-8 border-t border-spruce-200 dark:border-spruce-800 space-y-3 bg-spruce-50/50 dark:bg-spruce-950/50">
          <div className="flex items-center justify-between text-xs text-spruce-500">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isFetching
                      ? 'bg-spruce-400'
                      : realtimeStatus === 'connected'
                      ? 'bg-emerald-400'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isFetching
                      ? 'bg-spruce-500'
                      : realtimeStatus === 'connected'
                      ? 'bg-emerald-500'
                      : realtimeStatus === 'connecting'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="text-[11px] font-medium truncate">
                {isFetching
                  ? 'Syncing...'
                  : realtimeStatus === 'connected'
                  ? 'Live Connected'
                  : realtimeStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="h-6 px-1.5 text-[10px]"
              >
                Refresh
              </Button>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 text-spruce-600 dark:text-spruce-300">
                {APP_VERSION}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-center gap-2 h-9 text-xs font-semibold border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900 text-spruce-800 dark:text-spruce-200 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-500 dark:hover:text-rose-300 transition-colors shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* -------------------------------------------------------------
          2. MOBILE NAVBAR & RESPONSIVE DRAWER (<lg)
         ------------------------------------------------------------- */}
      <div className="lg:hidden sticky top-0 z-30 border-b border-spruce-200 dark:border-spruce-800 bg-white/95 dark:bg-spruce-950/95 backdrop-blur-md px-3 sm:px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900 border border-spruce-200 dark:border-spruce-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400 transition-colors shrink-0"
          >
            {isMobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <div className="w-7 h-7 rounded-lg bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-xs shadow-sm shrink-0">
            TS
          </div>
          <span className="font-extrabold text-base tracking-tight text-spruce-900 dark:text-white">
            TicketSupport
          </span>
          <span className="hidden xs:inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-spruce-100 text-spruce-800 dark:bg-spruce-800/80 dark:text-spruce-300 border border-spruce-300/60 dark:border-spruce-700 whitespace-nowrap">
            IT Console
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationCenter onSelectTicket={handleSelectTicket} />
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs px-2.5">
            Sign Out
          </Button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-spruce-950/70 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[80vw] h-full bg-white dark:bg-spruce-950 p-4 flex flex-col justify-between shadow-2xl"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-spruce-200 dark:border-spruce-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-spruce-800 text-spruce-300 dark:bg-spruce-300 dark:text-spruce-950 font-black flex items-center justify-center text-[11px] shadow-sm shrink-0">
                    TS
                  </div>
                  <span className="font-extrabold text-base tracking-tight">TicketSupport</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1 rounded-md text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {user && (
                <div className="p-2.5 rounded-lg bg-spruce-100/70 dark:bg-spruce-900 text-xs space-y-1">
                  <p className="font-semibold">{getUserDisplayName(user)}</p>
                  {user.email && <p className="text-spruce-500">{user.email}</p>}
                  <Badge variant="secondary">{user.role}</Badge>
                </div>
              )}

              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('DASHBOARD');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'DASHBOARD'
                      ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Dashboard Overview</span>
                  {unassignedTickets.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-500 font-bold">
                      {unassignedTickets.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('ALL_TICKETS');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'ALL_TICKETS'
                      ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>All Tickets</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-spruce-200 dark:bg-spruce-800 font-bold text-spruce-700 dark:text-spruce-300">
                    {tickets.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('ASSIGNED_TICKETS');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                    activeSection === 'ASSIGNED_TICKETS'
                      ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950'
                      : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                  }`}
                >
                  <span>Assigned Tickets</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-spruce-200 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-300 font-bold">
                    {myAssignedTickets.length}
                  </span>
                </button>

                {user?.role === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('TEAM_MANAGEMENT');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold ${
                      activeSection === 'TEAM_MANAGEMENT'
                        ? 'bg-spruce-800 text-white dark:bg-spruce-300 dark:text-spruce-950'
                        : 'text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900'
                    }`}
                  >
                    <span>Team &amp; Invites</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-500 uppercase font-bold">
                      Admin
                    </span>
                  </button>
                )}

                <div className="pt-2">
                  <Link
                    href="/portal"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center justify-between p-2.5 rounded-md text-xs font-semibold text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-900"
                  >
                    <span>Customer Portal</span>
                    <span className="text-[10px] font-bold text-spruce-400 uppercase tracking-wider">
                      Portal
                    </span>
                  </Link>
                </div>
              </nav>
            </div>

            <div className="pt-4 border-t border-spruce-200 dark:border-spruce-800 space-y-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="w-full text-xs"
              >
                Sign Out
              </Button>
              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="text-spruce-500 font-medium">Version</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 text-spruce-600 dark:text-spruce-300">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. MAIN CONTENT WORKSPACE (lg:pl-64, flex-1)
         ------------------------------------------------------------- */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {/* Main Top Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-spruce-200 dark:border-spruce-800 pb-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-spruce-900 dark:text-white">
                {activeSection === 'DASHBOARD' && 'IT Service Desk Queue'}
                {activeSection === 'ALL_TICKETS' && 'All Customer Tickets'}
                {activeSection === 'ASSIGNED_TICKETS' && 'Assigned Incidents Queue'}
                {activeSection === 'TEAM_MANAGEMENT' && 'IT Support Team & Staff Invitations'}
              </h1>
              <p className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-400 mt-1 max-w-xl leading-relaxed">
                {activeSection === 'DASHBOARD' &&
                  'Monitor live SLA metrics, triage incoming unassigned tickets, and resolve assigned incidents.'}
                {activeSection === 'ALL_TICKETS' &&
                  'Browse, filter, and inspect all incoming customer incidents across priorities and statuses.'}
                {activeSection === 'ASSIGNED_TICKETS' &&
                  'Dedicated workspace for support engineers resolving their active queue.'}
                {activeSection === 'TEAM_MANAGEMENT' &&
                  'Invite-only access: invite support engineers, generate secure claim links, and manage staff accounts.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {formattedLastUpdated && (
                <div
                  data-testid="dashboard-last-updated"
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/80 text-xs text-spruce-700 dark:text-spruce-300 tabular-nums shrink-0 whitespace-nowrap shadow-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isFetching ? 'bg-spruce-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isFetching ? 'bg-spruce-500' : 'bg-emerald-500'
                      }`}
                    />
                  </span>
                  <span>
                    <span className="hidden sm:inline text-spruce-400">Updated: </span>
                    <strong className="font-semibold text-spruce-900 dark:text-spruce-200">{formattedLastUpdated}</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center shrink-0">
                {updateTicketMutation.isPending && (
                  <ContextualLoader context="triage-update" />
                )}
                {addCommentMutation.isPending && (
                  <ContextualLoader context="comment-post" />
                )}
                {deleteTicketMutation.isPending && (
                  <ContextualLoader context="ticket-delete" />
                )}
              </div>
              <ThemeToggle />
              <NotificationCenter onSelectTicket={handleSelectTicket} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="w-32 shrink-0 text-xs h-8 justify-center text-center font-medium"
              >
                {isFetching && hasLoadedTickets ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Syncing...
                  </span>
                ) : (
                  'Refresh Queue'
                )}
              </Button>
            </div>
          </div>

          {/* Live Real-Time Stream Banner */}
          {realtimeAlert && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-spruce-300/80 bg-spruce-100/90 text-spruce-900 dark:border-spruce-600/50 dark:bg-spruce-900/80 dark:text-spruce-200 text-xs shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spruce-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-spruce-500" />
                </span>
                <span className="font-semibold">{realtimeAlert}</span>
                <span className="text-[10px] text-spruce-800 dark:text-spruce-300 font-mono uppercase px-1 py-0.5 rounded bg-spruce-200 dark:bg-spruce-800">
                  Live SSE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRealtimeAlert(null)}
                className="text-spruce-700 hover:text-spruce-950 dark:text-spruce-300 dark:hover:text-white text-xs font-semibold px-2 py-0.5 rounded hover:bg-spruce-200/60 dark:hover:bg-spruce-800 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Expand / Collapse toggle for ticket sections */}
          {activeSection !== 'TEAM_MANAGEMENT' && displayedTickets.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAllAccordions}
                className="h-7 text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white"
              >
                {allExpanded ? 'Collapse All Cards' : 'Expand All Cards'}
              </Button>
            </div>
          )}

          {/* ===================================================================
              SECTION 1: DASHBOARD OVERVIEW
             =================================================================== */}
          {activeSection === 'DASHBOARD' && (
            <div className="space-y-6">
              {showInitialSkeleton ? (
                <ContextualLoader context="admin-kpi" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
                  {/* 1. Critical & Urgent Incidents (Highest Priority) */}
                  <Card
                    onClick={() => {
                      setPriorityFilter('URGENT');
                      setActiveSection('ALL_TICKETS');
                    }}
                    className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
                  >
                    <CardContent className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                          Urgent / High
                        </p>
                        {kpis.urgentHigh > 0 && (
                          <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                            Critical
                          </span>
                        )}
                      </div>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {kpis.urgentHigh}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        {kpis.urgentHigh > 0 ? 'Production blockers active' : 'No critical incidents'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* 2. Unassigned Queue (High Priority Triage) */}
                  <Card
                    onClick={() => {
                      setAssignmentFilter('UNASSIGNED');
                      setActiveSection('ALL_TICKETS');
                    }}
                    className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
                  >
                    <CardContent className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                          Unassigned Queue
                        </p>
                        {unassignedTickets.length > 0 && (
                          <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Triage
                          </span>
                        )}
                      </div>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {unassignedTickets.length}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        {unassignedTickets.length > 0 ? 'Awaiting engineer claim' : 'Queue fully triaged'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* 3. Assigned to Me (Personal Focus) */}
                  <Card
                    onClick={() => {
                      setAssignedScope('MINE');
                      setActiveSection('ASSIGNED_TICKETS');
                    }}
                    className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm"
                  >
                    <CardContent className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                          Assigned to Me
                        </p>
                        <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-spruce-100 text-spruce-700 dark:bg-spruce-800 dark:text-spruce-300 border border-spruce-200 dark:border-spruce-700">
                          Active
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {myAssignedTickets.length}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        My personal incidents
                      </p>
                    </CardContent>
                  </Card>

                  {/* 4. Customer Satisfaction Score (Quality KPI) */}
                  <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
                    <CardContent className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                          CSAT Score
                        </p>
                        <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-spruce-100 text-spruce-700 dark:bg-spruce-800 dark:text-spruce-300 border border-spruce-200 dark:border-spruce-700">
                          KPI
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {kpis.csatAverage ? `${kpis.csatAverage} / 5.0` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        {kpis.csatCount > 0
                          ? `${kpis.csatCount} ${kpis.csatCount === 1 ? 'review recorded' : 'reviews recorded'}`
                          : 'Awaiting reviews'}
                      </p>
                    </CardContent>
                  </Card>

                  {/* 5. In Progress / Needs Info (Operational Workflow) */}
                  <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
                    <CardContent className="p-3.5 space-y-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                        In Progress / Info
                      </p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {kpis.inProgress + kpis.needsInfo}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        Active investigations
                      </p>
                    </CardContent>
                  </Card>

                  {/* 6. Resolved / Closed (Completed Work) */}
                  <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors shadow-sm">
                    <CardContent className="p-3.5 space-y-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                        Resolved / Closed
                      </p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {kpis.resolvedClosed}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        Closed incidents
                      </p>
                    </CardContent>
                  </Card>

                  {/* 7. Total Queue Baseline */}
                  <Card
                    onClick={() => {
                      setAssignmentFilter('ALL');
                      setActiveSection('ALL_TICKETS');
                    }}
                    className="cursor-pointer border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors col-span-2 sm:col-span-3 lg:col-span-2 2xl:col-span-1 shadow-sm"
                  >
                    <CardContent className="p-3.5 space-y-1">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider truncate text-spruce-500 dark:text-spruce-400">
                        Total Tickets
                      </p>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-spruce-900 dark:text-spruce-100">
                        {kpis.total}
                      </p>
                      <p className="text-[10px] text-spruce-500 dark:text-spruce-400 truncate">
                        All incidents in desk
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Support Team Workload Summary */}
              {agents.length > 0 && (
                <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-200">
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
                      className="h-7 text-xs text-spruce-700 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white"
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
                          className="p-3 rounded-lg border border-spruce-200 dark:border-spruce-700/80 bg-spruce-50/70 dark:bg-spruce-950/70 flex items-center justify-between gap-2 shadow-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-spruce-950 dark:text-white truncate">
                                {agent.fullName}
                              </span>
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-spruce-200 text-spruce-900 dark:bg-spruce-800 dark:text-spruce-200 border border-spruce-300 dark:border-spruce-700">
                                {agent.role}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-spruce-600 dark:text-spruce-300 flex items-center gap-1.5 pt-0.5">
                              <strong className="text-spruce-900 dark:text-spruce-100 font-semibold">{activeCount} active</strong>
                              <span className="text-spruce-400 dark:text-spruce-600">•</span>
                              <span className="text-emerald-600 dark:text-emerald-300 font-medium">{resolvedCount} resolved</span>
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
                            className="h-7 text-xs shrink-0 border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800 hover:bg-spruce-100 dark:hover:bg-spruce-700 text-spruce-800 dark:text-spruce-100 shadow-xs"
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
                    <h2 className="text-lg font-bold text-spruce-900 dark:text-white">
                      Immediate Triage &amp; Unassigned Queue ({displayedTickets.length})
                    </h2>
                    <p className="text-xs text-spruce-500">
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
              <Card className="border-spruce-200 dark:border-spruce-800 bg-spruce-100/50 dark:bg-spruce-950/70 shadow-xs">
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

                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-2 border-t border-spruce-100 dark:border-spruce-800">
                    <select
                      aria-label="Filter by Priority"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="h-9 rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
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
              <Card className="border-spruce-200 dark:border-spruce-800 bg-spruce-100/50 dark:bg-spruce-950/70 shadow-xs">
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* Scope Switcher: Assigned to Me vs All Assigned vs Specific Engineer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-spruce-100 dark:border-spruce-800">
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
                        className="h-9 rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
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
          {/* ===================================================================
              SECTION 4: IT SUPPORT TEAM & STAFF INVITATIONS (ADMIN ONLY)
             =================================================================== */}
          {activeSection === 'TEAM_MANAGEMENT' && user?.role === 'ADMIN' && (
            <div className="space-y-6">
              {/* Subtab Switcher */}
              <div className="flex flex-wrap items-center gap-2 border-b border-spruce-200 dark:border-spruce-800 pb-3">
                <Button
                  type="button"
                  size="sm"
                  variant={teamManagementSubtab === 'MEMBERS' ? 'default' : 'outline'}
                  onClick={() => setTeamManagementSubtab('MEMBERS')}
                  className="text-xs font-semibold"
                >
                  IT Staff Members ({agents.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={teamManagementSubtab === 'INVITE' ? 'default' : 'outline'}
                  onClick={() => setTeamManagementSubtab('INVITE')}
                  className="text-xs font-semibold"
                >
                  Generate Staff Invitation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={teamManagementSubtab === 'PROVISION' ? 'default' : 'outline'}
                  onClick={() => setTeamManagementSubtab('PROVISION')}
                  className="text-xs font-semibold"
                >
                  Direct Provision Account
                </Button>
              </div>

              {/* SUBTAB 1: TEAM MEMBERS */}
              {teamManagementSubtab === 'MEMBERS' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => {
                      const assignedCount = tickets.filter(
                        (t) => resolveTicketAssigneeId(t) === agent.id && t.status !== 'CLOSED',
                      ).length;
                      return (
                        <Card key={agent.id} className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200 font-bold flex items-center justify-center shrink-0 border border-spruce-300 dark:border-spruce-700 text-xs shadow-xs">
                                {agent.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate text-spruce-950 dark:text-white">
                                  {agent.fullName}
                                </p>
                                <p className="text-xs text-spruce-600 dark:text-spruce-300 truncate">{agent.email}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <Badge variant={agent.role === 'ADMIN' ? 'default' : 'secondary'}>
                                {agent.role}
                              </Badge>
                              <p className="text-[11px] text-spruce-700 dark:text-spruce-200 font-medium">
                                {assignedCount} active {assignedCount === 1 ? 'ticket' : 'tickets'}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: GENERATE STAFF INVITATION */}
              {teamManagementSubtab === 'INVITE' && (
                <div className="space-y-6">
                  <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
                        Issue Staff Invitation Link / Code
                      </CardTitle>
                      <p className="text-xs text-spruce-600 dark:text-spruce-300 leading-relaxed">
                        Generate a secure invitation link for new Support Engineers or Administrators. Public registration only creates customer accounts; staff members must redeem this invitation to activate engineer permissions.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {inviteSuccessMessage && (
                        <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                          {inviteSuccessMessage}
                        </div>
                      )}
                      {inviteError && (
                        <div className="p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300">
                          {inviteError}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          createInviteMutation.mutate({
                            email: inviteEmail,
                            role: inviteRole,
                          });
                        }}
                        className="space-y-4 max-w-xl"
                      >
                        <div className="space-y-1.5">
                          <label
                            htmlFor="invite-email"
                            className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                          >
                            Staff Email Address
                          </label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="engineer@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label
                            htmlFor="invite-role"
                            className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                          >
                            Staff Role
                          </label>
                          <select
                            id="invite-role"
                            value={inviteRole}
                            onChange={(e) =>
                              setInviteRole(e.target.value as 'AGENT' | 'ADMIN')
                            }
                            className="flex h-9 w-full rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
                          >
                            <option value="AGENT">Support Engineer (AGENT)</option>
                            <option value="ADMIN">Administrator (ADMIN)</option>
                          </select>
                        </div>

                        <Button
                          type="submit"
                          size="sm"
                          disabled={createInviteMutation.isPending || !inviteEmail}
                          className="text-xs"
                        >
                          {createInviteMutation.isPending
                            ? 'Generating...'
                            : 'Generate Invitation Link'}
                        </Button>
                      </form>

                      {generatedInviteCode && (
                        <div className="p-4 rounded-lg bg-spruce-50 dark:bg-spruce-950/80 border border-spruce-300 dark:border-spruce-700 space-y-2">
                          <span className="text-xs font-bold text-spruce-900 dark:text-spruce-200 uppercase tracking-wider">
                            Active Invitation Link Generated
                          </span>
                          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <Input
                              readOnly
                              value={
                                typeof window !== 'undefined'
                                  ? `${window.location.origin}?invite=${generatedInviteCode}`
                                  : generatedInviteCode
                              }
                              className="text-xs font-mono h-9 bg-white dark:bg-spruce-900 text-spruce-950 dark:text-white border-spruce-300 dark:border-spruce-700 flex-1"
                            />
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => handleCopyInviteLink(generatedInviteCode)}
                              className="text-xs shrink-0 bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950 font-semibold"
                            >
                              {copiedLink ? 'Copied to Clipboard!' : 'Copy Invite Link'}
                            </Button>
                          </div>
                          <p className="text-[11px] text-spruce-600 dark:text-spruce-300">
                            The recipient can open this link to register their staff account directly.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pending & Historical Invites List */}
                  <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
                        Staff Invitations ({invites.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {invites.length === 0 ? (
                        <p className="p-6 text-center text-xs text-spruce-600 dark:text-spruce-400">
                          No staff invitations issued yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-spruce-100 dark:divide-spruce-800/80 overflow-x-auto">
                          {invites.map((invite) => {
                            const isExpired = new Date() > new Date(invite.expiresAt);
                            return (
                              <div
                                key={invite.id}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <strong className="text-sm font-bold text-spruce-950 dark:text-white">
                                      {invite.email}
                                    </strong>
                                    <Badge
                                      variant={
                                        invite.role === 'ADMIN' ? 'default' : 'secondary'
                                      }
                                    >
                                      {invite.role}
                                    </Badge>
                                    {invite.accepted ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
                                        Redeemed
                                      </span>
                                    ) : isExpired ? (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-semibold">
                                        Expired
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold">
                                        Pending
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-spruce-600 dark:text-spruce-300 font-mono">
                                    Code: <span className="font-semibold text-spruce-900 dark:text-spruce-100">{invite.code}</span> • Expires{' '}
                                    {new Date(invite.expiresAt).toLocaleDateString()}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {!invite.accepted && !isExpired && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyInviteLink(invite.code)}
                                      className="h-7 text-[11px] border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-800 hover:bg-spruce-100 dark:hover:bg-spruce-700 text-spruce-800 dark:text-spruce-200 shadow-xs"
                                    >
                                      Copy Link
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => revokeInviteMutation.mutate(invite.id)}
                                    className="h-7 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                                  >
                                    Revoke
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* SUBTAB 3: DIRECT PROVISIONING */}
              {teamManagementSubtab === 'PROVISION' && (
                <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm max-w-xl">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-spruce-950 dark:text-white">
                      Directly Provision Staff Account
                    </CardTitle>
                    <p className="text-xs text-spruce-600 dark:text-spruce-300 leading-relaxed">
                      Create an IT Support Engineer or Administrator account immediately with an initial password.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {provisionSuccessMessage && (
                      <div className="p-3 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                        {provisionSuccessMessage}
                      </div>
                    )}
                    {provisionError && (
                      <div className="p-3 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300">
                        {provisionError}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        adminCreateUserMutation.mutate({
                          fullName: provisionFullName,
                          email: provisionEmail,
                          password: provisionPassword,
                          role: provisionRole,
                        });
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor="provision-name"
                          className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                        >
                          Full Name
                        </label>
                        <Input
                          id="provision-name"
                          placeholder="e.g. Alex Rivera"
                          value={provisionFullName}
                          onChange={(e) => setProvisionFullName(e.target.value)}
                          required
                          className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="provision-email"
                          className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                        >
                          Email Address
                        </label>
                        <Input
                          id="provision-email"
                          type="email"
                          placeholder="alex.rivera@company.com"
                          value={provisionEmail}
                          onChange={(e) => setProvisionEmail(e.target.value)}
                          required
                          className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="provision-password"
                          className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                        >
                          Initial Password
                        </label>
                        <Input
                          id="provision-password"
                          type="password"
                          placeholder="Minimum 6 characters"
                          value={provisionPassword}
                          onChange={(e) => setProvisionPassword(e.target.value)}
                          required
                          className="text-xs h-9 bg-white dark:bg-spruce-950 text-spruce-950 dark:text-spruce-100 border-spruce-300 dark:border-spruce-700"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="provision-role"
                          className="text-xs font-bold text-spruce-800 dark:text-spruce-200"
                        >
                          Account Role
                        </label>
                        <select
                          id="provision-role"
                          value={provisionRole}
                          onChange={(e) =>
                            setProvisionRole(e.target.value as 'AGENT' | 'ADMIN')
                          }
                          className="flex h-9 w-full rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
                        >
                          <option value="AGENT">Support Engineer (AGENT)</option>
                          <option value="ADMIN">Administrator (ADMIN)</option>
                        </select>
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={adminCreateUserMutation.isPending}
                        className="text-xs"
                      >
                        {adminCreateUserMutation.isPending
                          ? 'Provisioning...'
                          : 'Provision Staff Account'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Full-Screen Image Lightbox Modal */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-spruce-950/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full bg-white dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800 rounded-xl p-4 space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 text-xs text-spruce-800 dark:text-spruce-200">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold truncate">{lightboxImage.fileName}</span>
                <span className="text-spruce-500 dark:text-spruce-400">
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
            <div className="flex items-center justify-center max-h-[80vh] overflow-auto bg-spruce-100/50 dark:bg-spruce-950 rounded-lg p-2">
              <img
                src={lightboxImage.dataUrl}
                alt={lightboxImage.fileName}
                className="max-h-[76vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          4. MOBILE BOTTOM NAVIGATION BAR (<lg)
         ------------------------------------------------------------- */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-spruce-950/95 backdrop-blur-md border-t border-spruce-200/90 dark:border-spruce-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-safe select-none"
      >
        <div className="grid grid-cols-5 items-center justify-around h-16 max-w-lg mx-auto px-2">
          {/* Tab 1: Overview / Dashboard */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('DASHBOARD');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === 'DASHBOARD'
                ? 'text-spruce-950 dark:text-spruce-100 font-bold'
                : 'text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeSection === 'DASHBOARD' ? 2.25 : 1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Overview</span>
          </button>

          {/* Tab 2: Queue / All Tickets */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('ALL_TICKETS');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === 'ALL_TICKETS'
                ? 'text-spruce-950 dark:text-spruce-100 font-bold'
                : 'text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeSection === 'ALL_TICKETS' ? 2.25 : 1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {unassignedTickets.length > 0 && (
                <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none text-white bg-amber-500 rounded-full shadow-xs">
                  {unassignedTickets.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Queue</span>
          </button>

          {/* Tab 3: Center Elevated Floating Quick Action (+) Button */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <button
              type="button"
              onClick={() => setIsQuickActionSheetOpen(true)}
              aria-label="Open quick actions menu"
              className="w-12 h-12 rounded-full bg-spruce-800 hover:bg-spruce-900 text-spruce-100 dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950 shadow-lg shadow-spruce-950/25 flex items-center justify-center border-4 border-spruce-50 dark:border-spruce-950 active:scale-95 transition-transform"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <span className="text-[10px] mt-1 font-semibold text-spruce-700 dark:text-spruce-300 tracking-tight">
              Actions
            </span>
          </div>

          {/* Tab 4: Assigned to Me */}
          <button
            type="button"
            onClick={() => {
              setActiveSection('ASSIGNED_TICKETS');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
              activeSection === 'ASSIGNED_TICKETS'
                ? 'text-spruce-950 dark:text-spruce-100 font-bold'
                : 'text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium'
            }`}
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeSection === 'ASSIGNED_TICKETS' ? 2.25 : 1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {myAssignedTickets.length > 0 && (
                <span className="absolute -top-1 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold leading-none text-white bg-spruce-700 dark:bg-spruce-400 dark:text-spruce-950 rounded-full shadow-xs">
                  {myAssignedTickets.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Assigned</span>
          </button>

          {/* Tab 5: Full Menu / More Drawer */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open full navigation drawer"
            className="flex flex-col items-center justify-center py-1 rounded-xl transition-all text-spruce-400 dark:text-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300 font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] mt-0.5 tracking-tight">Menu</span>
          </button>
        </div>
      </nav>

      {/* -------------------------------------------------------------
          5. MOBILE QUICK ACTIONS BOTTOM SHEET MODAL (<lg)
         ------------------------------------------------------------- */}
      {isQuickActionSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsQuickActionSheetOpen(false)}
          className="lg:hidden fixed inset-0 z-50 bg-spruce-950/70 backdrop-blur-sm flex flex-col justify-end p-3 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-spruce-900 rounded-2xl p-5 space-y-4 shadow-2xl border border-spruce-200 dark:border-spruce-800 max-w-md w-full mx-auto"
          >
            <div className="flex items-center justify-between border-b border-spruce-100 dark:border-spruce-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-300 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-bold text-sm text-spruce-950 dark:text-white">Quick IT Actions</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickActionSheetOpen(false)}
                className="p-1 rounded-md text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 hover:bg-spruce-100 dark:hover:bg-spruce-800 transition-colors"
                aria-label="Close quick actions"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Action 1: Refresh Queue */}
              <button
                type="button"
                onClick={() => {
                  refetch();
                  setIsQuickActionSheetOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-spruce-100 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-200 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">Refresh Incident Queue</div>
                  <div className="text-[11px] text-spruce-500">Fetch newest customer reports & status updates</div>
                </div>
              </button>

              {/* Action 2: Triage Unassigned Incidents */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('ALL_TICKETS');
                  setAssignmentFilter('UNASSIGNED');
                  setIsQuickActionSheetOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">
                    Triage Unassigned ({unassignedTickets.length})
                  </div>
                  <div className="text-[11px] text-spruce-500">Jump straight into unassigned ticket claiming</div>
                </div>
              </button>

              {/* Action 3: Filter Critical / Urgent Blockers */}
              <button
                type="button"
                onClick={() => {
                  setActiveSection('ALL_TICKETS');
                  setPriorityFilter('URGENT');
                  setIsQuickActionSheetOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-spruce-950 dark:text-white">
                    Filter Urgent Incidents ({kpis.urgentHigh})
                  </div>
                  <div className="text-[11px] text-spruce-500">Focus on production blockers and high priority SLAs</div>
                </div>
              </button>

              {/* Action 4: Invite Support Staff (Admin only) */}
              {user?.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('TEAM_MANAGEMENT');
                    setTeamManagementSubtab('INVITE');
                    setIsQuickActionSheetOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-spruce-200 dark:border-spruce-800 hover:bg-spruce-50 dark:hover:bg-spruce-800/60 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-spruce-950 dark:text-white">Invite Support Engineer</div>
                    <div className="text-[11px] text-spruce-500">Generate secure invitation code for onboarding</div>
                  </div>
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuickActionSheetOpen(false)}
              className="w-full text-xs"
            >
              Close Actions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
