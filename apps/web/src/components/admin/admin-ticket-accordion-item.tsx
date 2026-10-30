"use client";

import * as React from "react";
import { Card, CardContent } from "@ui/card";
import { Button } from "@ui/button";
import { Badge } from "@ui/badge";
import { Input } from "@ui/input";
import { CannedResponsesMenu } from "@components/canned-responses-menu";
import type { Ticket } from "@components/ticket-list";
import {
  AuthUser,
  DecryptedAttachmentResult,
  resolveTicketAssigneeId,
  computeTicketSlaStatus,
  formatByteSize,
  formatTicketDateTime,
} from "@lib/helpers";
import {
  TicketCardHeader,
  getTicketCardBorderClasses,
} from "@components/tickets/ticket-card-header";
import { TicketAttachmentPreview } from "@components/tickets/ticket-attachment-preview";
import { TicketCommentThread } from "@components/tickets/ticket-comment-thread";
import { FormEvent } from "react";

interface AdminTicketAccordionItemProps {
  ticket: Ticket;
  user: AuthUser | null;
  agents: AuthUser[];
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  isViewed: boolean;
  onToggleViewed?: (id: string) => void;
  highlighted: boolean;
  onUpdateStatus: (id: string, status: Ticket["status"]) => void;
  onUpdatePriority: (id: string, priority: Ticket["priority"]) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onAutoAssignTicket?: (id: string) => void;
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
  onPostNote: (id: string, e: FormEvent) => void;
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
  onAutoAssignTicket,
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
  const commentCount = ticket.comments?.length || 0;
  const sla = computeTicketSlaStatus(ticket);
  const assigneeId = resolveTicketAssigneeId(ticket);
  const isTicketAssigned = Boolean(assigneeId);
  const isClosed = ticket.status === "CLOSED";
  const isAdmin = user?.role === "ADMIN";
  const isAssignedToMe = Boolean(user?.id && assigneeId === user.id);
  const isAssignedToOther = Boolean(
    assigneeId && user?.id && assigneeId !== user.id,
  );
  const canManageTicket = isAdmin || isAssignedToMe;

  const initialAttachmentKey = `ticket:${ticket.id}`;
  const decryptedTicketImg = decryptedAttachments[initialAttachmentKey];
  const isLoadingTicketImg = Boolean(
    loadingAttachmentKeys[initialAttachmentKey],
  );
  const isTicketImgHidden = Boolean(hiddenAttachmentKeys[initialAttachmentKey]);

  return (
    <Card
      key={ticket.id}
      id={`ticket-${ticket.id}`}
      className={`overflow-hidden transition-all duration-150 ${getTicketCardBorderClasses(
        {
          isHighlighted: highlighted,
          isViewed,
          status: ticket.status,
        },
      )}`}
    >
      <TicketCardHeader
        ticket={ticket}
        isExpanded={isExpanded}
        isViewed={isViewed}
        onToggleExpand={onToggleExpanded}
        showAssignee={true}
        slaInfo={sla}
      />

      {/* Accordion Body */}
      {isExpanded && (
        <CardContent className="p-4 sm:p-5 pt-0 space-y-5 border-t border-spruce-100 dark:border-spruce-800/80">
          {/* Priority Auto-Escalation Banner */}
          {ticket.autoEscalated && (
            <div className="pt-3">
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200 text-xs shadow-xs">
                <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-300 shrink-0">
                  ⚡ PRIORITY AUTO-ESCALATED
                </span>
                <span>
                  {ticket.escalationReason ||
                    "System auto-escalated this incident to URGENT based on critical outage keywords."}
                </span>
              </div>
            </div>
          )}

          {/* 1. Admin / Agent Triage & Actions Bar */}
          {isClosed ? (
            <div className="pt-3 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  Closed &amp; Archived
                </span>
                <span className="text-spruce-600 dark:text-spruce-300">
                  This ticket is closed. It cannot be modified by staff unless
                  the customer reopens it from the portal.
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
                      onUpdatePriority(
                        ticket.id,
                        e.target.value as Ticket["priority"],
                      )
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
                      value={assigneeId || ""}
                      onChange={(e) =>
                        onUpdateAssignee(ticket.id, e.target.value || null)
                      }
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
                {onAutoAssignTicket && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAutoAssignTicket(ticket.id)}
                    className="h-8 text-xs font-medium border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-900"
                    title="Automatically assigns to the next eligible agent via round-robin distribution"
                  >
                    Auto-assign (Round-Robin)
                  </Button>
                )}
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
                  Assigned to:{" "}
                  <strong className="font-semibold text-spruce-900 dark:text-spruce-100">
                    {ticket.assignee?.fullName || "Another Agent"}
                  </strong>
                </span>
                <span className="text-spruce-400 dark:text-spruce-600">•</span>
                <span className="text-spruce-600 dark:text-spruce-300">
                  Status:{" "}
                  <strong className="text-spruce-900 dark:text-spruce-100">
                    {ticket.status.replace("_", " ")}
                  </strong>
                </span>
                <span className="text-spruce-400 dark:text-spruce-600">•</span>
                <span className="text-spruce-600 dark:text-spruce-300">
                  Priority:{" "}
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
                      onUpdateStatus(
                        ticket.id,
                        e.target.value as Ticket["status"],
                      )
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
                      onUpdatePriority(
                        ticket.id,
                        e.target.value as Ticket["priority"],
                      )
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
                      value={assigneeId || ""}
                      onChange={(e) =>
                        onUpdateAssignee(ticket.id, e.target.value || null)
                      }
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
                    <span className="font-semibold text-spruce-700 dark:text-spruce-300">
                      Assignee:
                    </span>
                    <span className="font-medium text-spruce-800 dark:text-spruce-200">
                      {ticket.assignee?.fullName || "Assigned to You"}
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
                  variant={isFollowUpOpen ? "default" : "secondary"}
                  size="sm"
                  onClick={() => onToggleFollowUp(ticket.id)}
                  className="h-8 text-xs"
                >
                  {isFollowUpOpen
                    ? "Cancel Follow-Up"
                    : "Request Info / Follow-Up"}
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
          {isTicketAssigned &&
            !isClosed &&
            canManageTicket &&
            isFollowUpOpen && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    Request Customer Follow-Up / Additional Info
                  </span>
                  <div className="flex items-center gap-2">
                    <CannedResponsesMenu
                      buttonLabel="Quick Templates"
                      context={{
                        customerName: ticket.creator?.fullName || "Customer",
                        ticketId: ticket.id,
                        ticketTitle: ticket.title,
                        agentName: user?.fullName || "IT Support",
                      }}
                      onSelect={(snippet) =>
                        onSetFollowUpPrompt(
                          followUpPrompt
                            ? `${followUpPrompt} ${snippet}`
                            : snippet,
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
                      onChange={(e) =>
                        onSetFollowUpAttachment(e.target.files?.[0] || null)
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
                      {isUpdating ? "Sending..." : "Send Follow-Up Request"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Customer Satisfaction Feedback Section */}
          {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") &&
            (typeof ticket.csatRating === "number" ? (
              <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/30 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/60">
                      CSAT Score {ticket.csatRating}.0 / 5.0
                    </span>
                    <span className="font-semibold text-spruce-800 dark:text-spruce-200">
                      {ticket.csatRating === 5
                        ? "Exceptional Resolution"
                        : ticket.csatRating === 4
                          ? "Satisfied"
                          : ticket.csatRating === 3
                            ? "Neutral"
                            : "Dissatisfied"}
                    </span>
                  </div>
                  {ticket.csatRatedAt && (
                    <span className="text-[10px] text-spruce-600 dark:text-spruce-400">
                      Rated on {formatTicketDateTime(ticket.csatRatedAt)}
                    </span>
                  )}
                </div>
                {ticket.csatComment && (
                  <p className="text-spruce-900 dark:text-spruce-100 italic bg-white dark:bg-spruce-900/60 p-2.5 rounded border border-amber-200/80 dark:border-amber-800/40">
                    &ldquo;{ticket.csatComment}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-spruce-300 dark:border-spruce-700/60 bg-spruce-50/80 dark:bg-spruce-900/30 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-spruce-600 dark:text-spruce-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                    CSAT Pending
                  </span>
                  <span className="text-spruce-700 dark:text-spruce-300">
                    Awaiting feedback from customer (
                    {ticket.creator?.fullName || "Customer"})
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-spruce-200 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-300">
                  Pending Rating
                </span>
              </div>
            ))}

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
                <TicketAttachmentPreview
                  attachmentName={ticket.attachmentName}
                  attachmentOriginalSize={ticket.attachmentOriginalSize}
                  decryptedImage={decryptedTicketImg}
                  isLoading={isLoadingTicketImg}
                  isHidden={isTicketImgHidden}
                  onToggleVisibility={() =>
                    onToggleAttachmentVisibility(initialAttachmentKey)
                  }
                  onClickPreview={onOpenLightbox}
                />
              )}
            </div>
          </div>

          {/* 3. Chronological Activity & Follow-Up History Timeline */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-spruce-500 dark:text-spruce-400">
              <span>Activity &amp; Follow-Up History ({commentCount})</span>
              <span>Chronological Order</span>
            </div>

            <TicketCommentThread
              comments={ticket.comments}
              ticketId={ticket.id}
              isHistoryExpanded={isHistoryExpanded}
              onToggleHistory={onToggleHistory}
              decryptedAttachments={decryptedAttachments}
              loadingAttachmentKeys={loadingAttachmentKeys}
              hiddenAttachmentKeys={hiddenAttachmentKeys}
              onToggleAttachmentVisibility={onToggleAttachmentVisibility}
              onInspectImage={onOpenLightbox}
            />
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
                  {isPostingNote ? "Posting..." : "Post Note"}
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
                      onSetCommentAttachment(
                        ticket.id,
                        e.target.files?.[0] || null,
                      )
                    }
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
                    customerName: ticket.creator?.fullName || "Customer",
                    ticketId: ticket.id,
                    ticketTitle: ticket.title,
                    agentName: user?.fullName || "IT Support",
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
              This ticket is currently assigned to{" "}
              <strong className="text-spruce-800 dark:text-spruce-200">
                {ticket.assignee?.fullName}
              </strong>
              . Click &quot;Take Over &amp; Reassign to Me&quot; above to post
              resolution notes or request customer info.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
