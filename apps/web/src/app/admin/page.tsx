'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { ContextualLoader } from '@ui/contextual-loader';
import { ThemeToggle } from '@components/theme-toggle';
import { NotificationCenter } from '@components/notification-center';
import { apiClient } from '@lib/api-client';
import {
  getStoredSession,
  formatLastUpdatedTimestamp,
  formatByteSize,
  filterTickets,
  computeTicketKpis,
  resolveTicketAssigneeId,
  compressAndEncryptImageFile,
  extractApiErrorMessage,
  sanitizeText,
  AuthUser,
  EncryptedAttachmentPayload,
} from '@lib/helpers';
import type { Ticket } from '@components/ticket-list';
import { useRealtimeEvents } from '@hooks/use-realtime-events';
import { useMounted } from '@hooks/use-mounted';
import { useAuthStore } from '@store/auth.store';
import { useTicketsStore } from '@store/tickets.store';
import { useAdminStore } from '@store/admin.store';
import {
  AdminSidebar,
  AdminMobileNav,
  AdminBottomNav,
  AdminKpiGrid,
  AdminAgentWorkload,
  AdminTicketFilters,
  AdminCannedResponses,
  AdminTeamManagement,
  AdminTicketAccordionItem,
  AdminReports,
  type StaffInviteRecord,
} from '@components/admin';

export default function AdminDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMounted = useMounted();

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
    viewedTicketIds,
    markTicketViewed,
    markTicketUnviewed,
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

  // Local state
  const [commentAttachments, setCommentAttachments] = React.useState<
    Record<string, File | null>
  >({});
  const [realtimeAlert, setRealtimeAlert] = React.useState<string | null>(null);
  const [followUpAttachment, setFollowUpAttachment] = React.useState<File | null>(null);
  const [actionErrors, setActionErrors] = React.useState<Record<string, string>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [teamManagementSubtab, setTeamManagementSubtab] = React.useState<
    'MEMBERS' | 'INVITE' | 'PROVISION'
  >('MEMBERS');

  // Invitations local state
  const [generatedInviteCode, setGeneratedInviteCode] = React.useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = React.useState<string | null>(null);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('ALL');

  // Direct provisioning local state
  const [provisionSuccessMessage, setProvisionSuccessMessage] = React.useState<string | null>(null);
  const [provisionError, setProvisionError] = React.useState<string | null>(null);

  // Real-time events subscription
  const { status: realtimeStatus } = useRealtimeEvents({
    onTicketCreated: (payload) => {
      const ticketId = payload?.id || payload?.ticketId;
      if (!ticketId) return;
      if (payload.title && payload.creatorId) {
        upsertTicket(payload as Ticket);
      }
      setRealtimeAlert(
        payload.title
          ? `New incident reported: "${payload.title}"`
          : `New incident #${ticketId.slice(0, 8)} reported`,
      );
    },
    onTicketUpdated: (payload) => {
      const ticketId = payload?.id || payload?.ticketId;
      if (!ticketId) return;

      const existing = tickets.find((t) => t.id === ticketId);
      if (existing) {
        const merged: Ticket = {
          ...existing,
          ...payload,
          id: ticketId,
        };
        upsertTicket(merged);
        void ensureTicketAttachmentsLoaded(merged);
      }
      setRealtimeAlert(`Ticket #${ticketId.slice(0, 8)} updated`);
    },
    onTicketDeleted: (payload) => {
      const ticketId = payload?.id || payload?.ticketId;
      if (!ticketId) return;
      removeTicket(ticketId);
      setRealtimeAlert(`Ticket #${ticketId.slice(0, 8)} deleted`);
    },
  });

  React.useEffect(() => {
    if (!realtimeAlert) return;
    const timer = setTimeout(() => setRealtimeAlert(null), 8000);
    return () => clearTimeout(timer);
  }, [realtimeAlert]);

  // Session guard
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = getStoredSession();
    if (!stored) {
      clearSession();
      router.replace('/');
      return;
    }
    if (!isSessionVerified) {
      void ensureSessionVerified().then((currentUser) => {
        if (!currentUser) {
          router.replace('/');
        }
      });
    }
  }, [clearSession, ensureSessionVerified, isSessionVerified, router]);

  // Tickets query
  const {
    data: queriedTickets,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: async () => {
      const res = await apiClient.get('/tickets');
      return res.data;
    },
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const tickets = queriedTickets ?? storedTickets;
  const showInitialSkeleton = isLoading && !hasLoadedTickets;
  const formattedLastUpdated = React.useMemo(
    () => (lastUpdatedAt ? formatLastUpdatedTimestamp(lastUpdatedAt) : null),
    [lastUpdatedAt],
  );

  React.useEffect(() => {
    if (queriedTickets) {
      setTickets(queriedTickets);
      initializeDefaultExpansion(queriedTickets);
    }
  }, [queriedTickets, setTickets, initializeDefaultExpansion]);

  // Agents query
  const { data: queriedAgents, refetch: refetchAgents } = useQuery<AuthUser[]>({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/auth/agents');
        return res.data;
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const agents = queriedAgents ?? storedAgents;

  React.useEffect(() => {
    if (queriedAgents) {
      setAgents(queriedAgents);
    }
  }, [queriedAgents, setAgents]);

  // Mutations
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

  const autoAssignMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const res = await apiClient.post(`/tickets/${ticketId}/auto-assign`);
      return res.data as Ticket;
    },
    onSuccess: (updatedTicket) => {
      if (updatedTicket?.id) {
        upsertTicket(updatedTicket);
        void ensureTicketAttachmentsLoaded(updatedTicket);
        setRealtimeAlert(
          `Ticket #${updatedTicket.id.slice(0, 8)} automatically assigned to ${updatedTicket.assignee?.fullName || 'Agent'}`,
        );
        setActionErrors((prev) => ({ ...prev, [updatedTicket.id]: '' }));
      }
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
    onError: (err: unknown, ticketId) => {
      const message = extractApiErrorMessage(err, 'Failed to auto-assign ticket');
      setActionErrors((prev) => ({ ...prev, [ticketId]: message }));
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
  const { data: invites = [], refetch: refetchInvites } = useQuery<StaffInviteRecord[]>({
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

  // Counts & Subsets
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
    [tickets, user],
  );

  // Compute displayed tickets for active section
  const displayedTickets = React.useMemo(() => {
    if (activeSection === 'DASHBOARD') {
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
        departmentFilter,
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
      return filterTickets(scoped, statusFilter, priorityFilter, searchQuery, departmentFilter);
    }

    if (activeSection === 'ALL_TICKETS') {
      const assignmentScoped = tickets.filter((t) => {
        const hasAssignee = Boolean(resolveTicketAssigneeId(t));
        if (assignmentFilter === 'UNASSIGNED') return !hasAssignee;
        if (assignmentFilter === 'ASSIGNED') return hasAssignee;
        return true;
      });
      return filterTickets(assignmentScoped, statusFilter, priorityFilter, searchQuery, departmentFilter);
    }

    return [];
  }, [
    activeSection,
    tickets,
    allAssignedTickets,
    assignedScope,
    assignmentFilter,
    statusFilter,
    priorityFilter,
    departmentFilter,
    searchQuery,
    user,
  ]);

  // Auto-load attachments when expanded
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

  if (!user?.fullName || isVerifyingSession || !isSessionVerified) {
    return <ContextualLoader context="admin-auth" />;
  }

  const renderTicketList = (emptyMessage: string) => {
    if (showInitialSkeleton) {
      return <ContextualLoader context="admin-queue" count={3} />;
    }

    if (displayedTickets.length === 0) {
      return (
        <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/40">
          <CardContent className="p-8 text-center text-sm text-spruce-500">
            {emptyMessage}
          </CardContent>
        </Card>
      );
    }

    return displayedTickets.map((ticket) => (
      <AdminTicketAccordionItem
        key={ticket.id}
        ticket={ticket}
        user={user}
        agents={agents}
        isExpanded={Boolean(expandedTicketIds[ticket.id])}
        onToggleExpanded={toggleTicketExpanded}
        isViewed={Boolean(viewedTicketIds[ticket.id])}
        onToggleViewed={(id) => {
          if (viewedTicketIds[id]) {
            markTicketUnviewed(id);
          } else {
            markTicketViewed(id);
          }
        }}
        highlighted={highlightedTicketId === ticket.id}
        onUpdateStatus={(id, status) =>
          updateTicketMutation.mutate({ id, payload: { status } })
        }
        onUpdatePriority={(id, priority) =>
          updateTicketMutation.mutate({ id, payload: { priority } })
        }
        onUpdateAssignee={(id, assigneeId) => {
          updateTicketMutation.mutate({
            id,
            payload: {
              assigneeId,
              ...(assigneeId && ticket.status === 'OPEN'
                ? { status: 'IN_PROGRESS' as const }
                : {}),
            },
          });
        }}
        onAutoAssignTicket={(id) => autoAssignMutation.mutate(id)}
        onClaimTicket={(id) => {
          if (user?.id) {
            updateTicketMutation.mutate({
              id,
              payload: {
                assigneeId: user.id,
                status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
              },
            });
          }
        }}
        onDeleteTicket={(id) => deleteTicketMutation.mutate(id)}
        isUpdating={updateTicketMutation.isPending}
        isDeleting={deleteTicketMutation.isPending}
        actionError={actionErrors[ticket.id]}
        decryptedAttachments={decryptedAttachments}
        loadingAttachmentKeys={loadingAttachmentKeys}
        hiddenAttachmentKeys={hiddenAttachmentKeys}
        onToggleAttachmentVisibility={toggleAttachmentVisibility}
        onOpenLightbox={setLightboxImage}
        isHistoryExpanded={Boolean(expandedCommentHistories[ticket.id])}
        onToggleHistory={toggleCommentHistory}
        draft={commentDrafts[ticket.id] || ''}
        onUpdateDraft={setCommentDraft}
        commentAttachment={commentAttachments[ticket.id]}
        onSetCommentAttachment={(id, file) =>
          setCommentAttachments((prev) => ({ ...prev, [id]: file }))
        }
        onPostNote={handlePostResolutionNote}
        isPostingNote={addCommentMutation.isPending}
        isFollowUpOpen={followUpTicketId === ticket.id}
        followUpPrompt={followUpPrompt}
        onSetFollowUpPrompt={setFollowUpPrompt}
        onToggleFollowUp={(id) => {
          if (followUpTicketId === id) {
            closeFollowUpComposer();
            setFollowUpAttachment(null);
          } else {
            openFollowUpComposer(id);
            setFollowUpAttachment(null);
          }
        }}
        followUpAttachment={followUpAttachment}
        onSetFollowUpAttachment={setFollowUpAttachment}
        onSendFollowUp={handleSendFollowUpRequest}
      />
    ));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-spruce-50 text-spruce-950 dark:bg-spruce-950 dark:text-spruce-50 transition-colors">
      {/* 1. Desktop Sidebar */}
      <AdminSidebar
        user={user}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        unassignedCount={unassignedTickets.length}
        totalTicketsCount={tickets.length}
        myAssignedCount={myAssignedTickets.length}
        isFetching={isFetching}
        realtimeStatus={realtimeStatus}
        onRefresh={() => refetch()}
        onSignOut={handleSignOut}
      />

      {/* 2. Mobile Navbar & Responsive Drawer */}
      <AdminMobileNav
        user={user}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isOpen={isMobileMenuOpen}
        onToggleOpen={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onClose={() => setIsMobileMenuOpen(false)}
        unassignedCount={unassignedTickets.length}
        totalTicketsCount={tickets.length}
        myAssignedCount={myAssignedTickets.length}
        onSelectTicket={handleSelectTicket}
        onSignOut={handleSignOut}
      />

      {/* 3. Main Content Workspace */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        <main className="flex-1 py-6 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {/* Main Top Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-spruce-200 dark:border-spruce-800 pb-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-spruce-900 dark:text-white">
                {activeSection === 'DASHBOARD' && 'IT Service Desk Queue'}
                {activeSection === 'ALL_TICKETS' && 'All Customer Tickets'}
                {activeSection === 'ASSIGNED_TICKETS' && 'Assigned Incidents Queue'}
                {activeSection === 'CANNED_RESPONSES' && 'Canned Responses & Templates'}
                {activeSection === 'TEAM_MANAGEMENT' && 'IT Support Team & Staff Invitations'}
                {activeSection === 'REPORTS' && 'Reports & CSAT Analytics Studio'}
              </h1>
              <p className="text-xs sm:text-sm text-spruce-600 dark:text-spruce-400 mt-1 max-w-xl leading-relaxed">
                {activeSection === 'DASHBOARD' &&
                  'Monitor live SLA metrics, triage incoming unassigned tickets, and resolve assigned incidents.'}
                {activeSection === 'ALL_TICKETS' &&
                  'Browse, filter, and inspect all incoming customer incidents across priorities and statuses.'}
                {activeSection === 'ASSIGNED_TICKETS' &&
                  'Dedicated workspace for support engineers resolving their active queue.'}
                {activeSection === 'CANNED_RESPONSES' &&
                  'Create, manage, and interpolate dynamic quick reply templates with variable placeholders.'}
                {activeSection === 'TEAM_MANAGEMENT' &&
                  'Invite-only access: invite support engineers, generate secure claim links, and manage staff accounts.'}
                {activeSection === 'REPORTS' &&
                  'Executive service desk metrics, technical support vs general department volumes, customer satisfaction (CSAT), and RFC 4180 CSV exports.'}
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
                    <strong
                      suppressHydrationWarning
                      className="font-semibold text-spruce-900 dark:text-spruce-200"
                    >
                      {formattedLastUpdated}
                    </strong>
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
          {activeSection !== 'TEAM_MANAGEMENT' &&
            activeSection !== 'CANNED_RESPONSES' &&
            displayedTickets.length > 0 && (
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

          {/* SECTION 1: DASHBOARD OVERVIEW */}
          {activeSection === 'DASHBOARD' && (
            <div className="space-y-6">
              <AdminKpiGrid
                kpis={kpis}
                unassignedCount={unassignedTickets.length}
                myAssignedCount={myAssignedTickets.length}
                isLoading={showInitialSkeleton}
                onFilterUrgent={() => {
                  setPriorityFilter('URGENT');
                  setActiveSection('ALL_TICKETS');
                }}
                onFilterUnassigned={() => {
                  setAssignmentFilter('UNASSIGNED');
                  setActiveSection('ALL_TICKETS');
                }}
                onFilterMyAssigned={() => {
                  setAssignedScope('MINE');
                  setActiveSection('ASSIGNED_TICKETS');
                }}
                onFilterAllTickets={() => {
                  setAssignmentFilter('ALL');
                  setActiveSection('ALL_TICKETS');
                }}
              />

              <AdminAgentWorkload
                agents={agents}
                assignedTickets={allAssignedTickets}
                currentUserId={user?.id}
                onViewAllAssigned={() => {
                  setAssignedScope('ALL_ASSIGNED');
                  setActiveSection('ASSIGNED_TICKETS');
                }}
                onSelectAgentQueue={(scope) => {
                  setAssignedScope(scope);
                  setActiveSection('ASSIGNED_TICKETS');
                }}
              />

              {/* Immediate Triage Queue */}
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

                {renderTicketList(
                  'All incoming tickets are currently assigned and triaged! Switch to "Assigned Tickets" or "All Tickets" to view active work.',
                )}
              </div>
            </div>
          )}

          {/* SECTION 2: ALL TICKETS */}
          {activeSection === 'ALL_TICKETS' && (
            <div className="space-y-4">
              <AdminTicketFilters
                mode="ALL_TICKETS"
                statusFilter={statusFilter}
                onSelectStatus={setStatusFilter}
                priorityFilter={priorityFilter}
                onSelectPriority={setPriorityFilter}
                departmentFilter={departmentFilter}
                onSelectDepartment={setDepartmentFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                assignmentFilter={assignmentFilter}
                onSelectAssignment={setAssignmentFilter}
                totalCount={tickets.length}
                unassignedCount={unassignedTickets.length}
                allAssignedCount={allAssignedTickets.length}
              />

              <div className="space-y-3">
                {renderTicketList('No tickets match the current filter criteria.')}
              </div>
            </div>
          )}

          {/* SECTION 3: ASSIGNED TICKETS */}
          {activeSection === 'ASSIGNED_TICKETS' && (
            <div className="space-y-4">
              <AdminTicketFilters
                mode="ASSIGNED_TICKETS"
                statusFilter={statusFilter}
                onSelectStatus={setStatusFilter}
                priorityFilter={priorityFilter}
                onSelectPriority={setPriorityFilter}
                departmentFilter={departmentFilter}
                onSelectDepartment={setDepartmentFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                assignedScope={assignedScope}
                onSelectAssignedScope={setAssignedScope}
                agents={agents}
                currentUserId={user?.id}
                myAssignedCount={myAssignedTickets.length}
                allAssignedCount={allAssignedTickets.length}
                allTickets={allAssignedTickets}
              />

              <div className="space-y-3">
                {renderTicketList(
                  assignedScope === 'MINE'
                    ? 'You do not have any tickets assigned to you matching these filters. Claim a ticket from Dashboard Overview or All Tickets!'
                    : 'No assigned tickets found matching the selected scope and filters.',
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: CANNED RESPONSES */}
          {activeSection === 'CANNED_RESPONSES' && (
            <AdminCannedResponses currentStaffName={user?.fullName} />
          )}

          {/* SECTION 5: TEAM & INVITES */}
          {activeSection === 'TEAM_MANAGEMENT' && user?.role === 'ADMIN' && (
            <AdminTeamManagement
              agents={agents}
              tickets={tickets}
              subtab={teamManagementSubtab}
              onSelectSubtab={setTeamManagementSubtab}
              invites={invites}
              onCreateInvite={(dto) => createInviteMutation.mutate(dto)}
              isCreatingInvite={createInviteMutation.isPending}
              inviteSuccessMessage={inviteSuccessMessage}
              inviteError={inviteError}
              generatedInviteCode={generatedInviteCode}
              onCopyInviteLink={handleCopyInviteLink}
              copiedLink={copiedLink}
              onRevokeInvite={(id) => revokeInviteMutation.mutate(id)}
              onProvisionUser={(dto) => adminCreateUserMutation.mutate(dto)}
              isProvisioning={adminCreateUserMutation.isPending}
              provisionSuccessMessage={provisionSuccessMessage}
              provisionError={provisionError}
            />
          )}

          {/* SECTION 6: REPORTS & CSAT ANALYTICS STUDIO */}
          {activeSection === 'REPORTS' && (
            <AdminReports />
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

      {/* 4. Mobile Bottom Navigation Bar */}
      <AdminBottomNav
        user={user}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        unassignedCount={unassignedTickets.length}
        myAssignedCount={myAssignedTickets.length}
        urgentCount={kpis.urgentHigh}
        onOpenMobileDrawer={() => setIsMobileMenuOpen(true)}
        onRefresh={() => refetch()}
        onFilterUnassigned={() => {
          setActiveSection('ALL_TICKETS');
          setAssignmentFilter('UNASSIGNED');
        }}
        onFilterUrgent={() => {
          setActiveSection('ALL_TICKETS');
          setPriorityFilter('URGENT');
        }}
        onOpenInviteSubtab={() => {
          setActiveSection('TEAM_MANAGEMENT');
          setTeamManagementSubtab('INVITE');
        }}
      />
    </div>
  );
}
