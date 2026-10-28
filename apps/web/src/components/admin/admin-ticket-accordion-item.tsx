'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Input } from '@ui/input';
import { CannedResponsesMenu } from '@components/canned-responses-menu';
import type { Ticket } from '@components/ticket-list';
import {
  AuthUser,
  DecryptedAttachmentResult,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  formatShortTicketId,
  formatTicketDateTime,
  formatCommentTime,
  formatByteSize,
  resolveTicketAssigneeId,
  countTicketAttachments,
  computeTicketSlaStatus,
  parseTimelineComment,
} from '@lib/helpers';

interface AdminTicketAccordionItemProps {
  ticket: Ticket;
  user: AuthUser | null;
  agents: AuthUser[];
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  isViewed: boolean;
  onToggleViewed: (id: string) => void;
  highlighted: boolean;
  onUpdateStatus: (id: string, status: Ticket['status']) => void;
  onUpdatePriority: (id: string, priority: Ticket['priority']) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onClaimTicket: (id: string) => void;
  onDeleteTicket: (id: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
  actionError?: string;
  decryptedAttachments: Record<string, DecryptedAttachmentResult>;
  loadingAttachmentKeys: Record<string, boolean>;
  hiddenAttachmentKeys: Record<string, boolean>;
  onToggleAttachmentVisibility: (key: string) => void;
  onOpenLightbox: (img: DecryptedAttachmentResult) => void;
  isHistoryExpanded: boolean;
  onToggleHistory: (id: string) => void;
  draft: string;
  onUpdateDraft: (id: string, val: string) => void;
  commentAttachment?: File | null;
  onSetCommentAttachment: (id: string, file: File | null) => void;
  onPostNote: (id: string, e: React.FormEvent) => void;
  isPostingNote: boolean;
  isFollowUpOpen: boolean;
  followUpPrompt: string;
  onSetFollowUpPrompt: (val: string) => void;
  onToggleFollowUp: (id: string) => void;
  followUpAttachment?: File | null;
  onSetFollowUpAttachment: (file: File | null) => void;
  onSendFollowUp: (ticket: Ticket) => void;
}

export function AdminTicketAccordionItem({
  ticket,
  user,
  agents,
  isExpanded,
  onToggleExpanded,
  isViewed,
  onToggleViewed,
  highlighted,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateAssignee,
  onClaimTicket,
  onDeleteTicket,
  isUpdating,
  isDeleting,
  actionError,
  decryptedAttachments,
  loadingAttachmentKeys,
  hiddenAttachmentKeys,
  onToggleAttachmentVisibility,
  onOpenLightbox,
  isHistoryExpanded,
  onToggleHistory,
  draft,
  onUpdateDraft,
  commentAttachment,
  onSetCommentAttachment,
  onPostNote,
  isPostingNote,
  isFollowUpOpen,
  followUpPrompt,
  onSetFollowUpPrompt,
  onToggleFollowUp,
  followUpAttachment,
  onSetFollowUpAttachment,
  onSendFollowUp,
}: AdminTicketAccordionItemProps) {
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
  const isLoadingTicketImg = Boolean(loadingAttachmentKeys[initialAttachmentKey]);
  const isTicketImgHidden = Boolean(hiddenAttachmentKeys[initialAttachmentKey]);

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
        highlighted
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
            onClick={() => onToggleExpanded(ticket.id)}
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
              onClick={() => onToggleViewed(ticket.id)}
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
                  disabled={isDeleting}
                  onClick={() => onDeleteTicket(ticket.id)}
                  className="h-8 text-xs shrink-0"
                >
                  Delete Ticket
                </Button>
              )}
            </div>
          ) : !isTicketAssigned ? (
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
                      onUpdatePriority(ticket.id, e.target.value as Ticket['priority'])
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
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`assignee-${ticket.id}`}
                      className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
                    >
                      Assignee:
                    </label>
                    <select
                      id={`assignee-${ticket.id}`}
                      value={assigneeId || ''}
                      onChange={(e) => onUpdateAssignee(ticket.id, e.target.value || null)}
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
                    onClick={() => onClaimTicket(ticket.id)}
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
                    disabled={isDeleting}
                    onClick={() => onDeleteTicket(ticket.id)}
                    className="h-8 text-xs"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : isAssignedToOther && !isAdmin ? (
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
                  onClick={() => onClaimTicket(ticket.id)}
                  className="h-8 text-xs shrink-0"
                >
                  Take Over &amp; Reassign to Me
                </Button>
              </div>
            </div>
          ) : (
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
                      onUpdateStatus(ticket.id, e.target.value as Ticket['status'])
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
                      onUpdatePriority(ticket.id, e.target.value as Ticket['priority'])
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
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`assignee-${ticket.id}`}
                      className="text-xs font-semibold text-spruce-700 dark:text-spruce-300"
                    >
                      Assignee:
                    </label>
                    <select
                      id={`assignee-${ticket.id}`}
                      value={assigneeId || ''}
                      onChange={(e) => onUpdateAssignee(ticket.id, e.target.value || null)}
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
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-spruce-700 dark:text-spruce-300">Assignee:</span>
                    <span className="font-medium text-spruce-800 dark:text-spruce-200">
                      {ticket.assignee?.fullName || 'Assigned to You'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateAssignee(ticket.id, null)}
                      className="h-7 px-2 text-[11px] text-spruce-500 hover:text-red-500"
                    >
                      Unassign
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={isFollowUpOpen ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => onToggleFollowUp(ticket.id)}
                  className="h-8 text-xs"
                >
                  {isFollowUpOpen ? 'Cancel Follow-Up' : 'Request Info / Follow-Up'}
                </Button>

                {isAdmin && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => onDeleteTicket(ticket.id)}
                    className="h-8 text-xs"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}

          {actionError && (
            <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {actionError}
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
                    context={{
                      customerName: ticket.creator?.fullName || 'Customer',
                      ticketId: ticket.id,
                      ticketTitle: ticket.title,
                      agentName: user?.fullName || 'IT Support',
                    }}
                    onSelect={(snippet) =>
                      onSetFollowUpPrompt(
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
                onChange={(e) => onSetFollowUpPrompt(e.target.value)}
                placeholder="Describe what details, steps, or screenshot you need from the customer..."
                className="flex w-full rounded-md border border-amber-500/40 bg-white dark:bg-spruce-950 px-3 py-2 text-xs shadow-sm text-spruce-900 dark:text-spruce-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => onSetFollowUpAttachment(e.target.files?.[0] || null)}
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
                    onClick={() => onToggleFollowUp(ticket.id)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => onSendFollowUp(ticket)}
                    className="h-8 text-xs"
                  >
                    {isUpdating ? 'Sending...' : 'Send Follow-Up Request'}
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
                        onClick={() => onToggleAttachmentVisibility(initialAttachmentKey)}
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
                        onClick={() => onOpenLightbox(decryptedTicketImg)}
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
              const earlierComments = hasMultiple ? comments.slice(0, -1) : [];
              const latestComment = comments[comments.length - 1];

              const renderAdminComment = (comment: (typeof comments)[0]) => {
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
                              onClick={() => onToggleAttachmentVisibility(commentAttachmentKey)}
                              className="h-7 text-xs"
                            >
                              {isCommentImgHidden ? 'Show Image' : 'Hide Image'}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-spruce-400">
                              {isLoadingCommentImg ? 'Loading image...' : ''}
                            </span>
                          )}
                        </div>

                        {decryptedCommentImg && !isCommentImgHidden && (
                          <div className="pt-1 max-w-full overflow-hidden">
                            <img
                              src={decryptedCommentImg.dataUrl}
                              alt={decryptedCommentImg.fileName}
                              onClick={() => onOpenLightbox(decryptedCommentImg)}
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
                        onClick={() => onToggleHistory(ticket.id)}
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
                          {isHistoryExpanded ? 'Collapse thread ↑' : 'Expand thread ↓'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Earlier comments shown when expanded */}
                  {hasMultiple && isHistoryExpanded && (
                    <div className="space-y-3">
                      {earlierComments.map((c) => renderAdminComment(c))}
                    </div>
                  )}

                  {/* Latest comment always visible */}
                  {latestComment && renderAdminComment(latestComment)}
                </div>
              );
            })()}
          </div>

          {/* 4. Post IT Resolution Note Composer */}
          {isTicketAssigned && !isClosed && canManageTicket && (
            <form
              onSubmit={(e) => onPostNote(ticket.id, e)}
              className="pt-2 border-t border-spruce-100 dark:border-spruce-800/80 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Add an IT resolution note or update for the customer..."
                  value={draft}
                  onChange={(e) => onUpdateDraft(ticket.id, e.target.value)}
                  className="text-xs h-9 flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPostingNote}
                  className="h-9 text-xs shrink-0"
                >
                  {isPostingNote ? 'Posting...' : 'Post Note'}
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
                    onChange={(e) => onSetCommentAttachment(ticket.id, e.target.files?.[0] || null)}
                    className="text-xs h-8 max-w-xs cursor-pointer"
                  />
                  {commentAttachment && (
                    <button
                      type="button"
                      onClick={() => onSetCommentAttachment(ticket.id, null)}
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      Remove ({formatByteSize(commentAttachment.size)})
                    </button>
                  )}
                </div>

                <CannedResponsesMenu
                  buttonLabel="Canned Responses"
                  direction="up"
                  align="right"
                  context={{
                    customerName: ticket.creator?.fullName || 'Customer',
                    ticketId: ticket.id,
                    ticketTitle: ticket.title,
                    agentName: user?.fullName || 'IT Support',
                  }}
                  onSelect={(snippet) =>
                    onUpdateDraft(
                      ticket.id,
                      draft ? `${draft} ${snippet}` : snippet,
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
}
