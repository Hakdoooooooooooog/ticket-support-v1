'use client';

import { useMemo } from 'react';
import { CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import {
  formatShortTicketId,
  formatTicketDate,
  countTicketAttachments,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
} from '@lib/helpers';
import type { Ticket } from './ticket-types';

export interface TicketCardHeaderProps {
  ticket: Ticket;
  isExpanded: boolean;
  isViewed: boolean;
  onToggleExpand: (id: string) => void;
  showAssignee?: boolean;
  slaInfo?: {
    label?: string;
    isBreached?: boolean;
    isResolved?: boolean;
  } | null;
}

/**
 * Shared border classes for Ticket cards across Customer Portal and IT Admin Console.
 * Color indicators are restricted exclusively to the outermost left border.
 */
export function getTicketCardBorderClasses({
  isHighlighted = false,
  isViewed = false,
  status,
}: {
  isHighlighted?: boolean;
  isViewed?: boolean;
  status?: Ticket['status'];
}): string {
  if (isHighlighted) {
    return 'ring-2 ring-spruce-400 dark:ring-spruce-300 shadow-xl shadow-spruce-500/20';
  }
  if (status === 'NEEDS_INFO') {
    return isViewed
      ? 'border-amber-400/60 dark:border-amber-500/50 border-l-4 border-l-amber-400 dark:border-l-amber-500 bg-amber-500/[0.03]'
      : 'border-amber-400 dark:border-amber-500 border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-500/10 shadow-sm';
  }
  if (!isViewed) {
    return 'border-spruce-300 dark:border-spruce-700/80 border-l-4 border-l-spruce-600 dark:border-l-spruce-400 bg-spruce-50/30 dark:bg-spruce-900/30 shadow-xs';
  }
  return 'border-spruce-200/80 dark:border-spruce-800/80 border-l-4 border-l-transparent bg-white/70 dark:bg-spruce-950/40 hover:bg-white dark:hover:bg-spruce-900/50';
}

function getRelativeTimeDisplay(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return 'overdue';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function TicketCardHeader({
  ticket,
  isExpanded,
  isViewed,
  onToggleExpand,
  showAssignee = false,
  slaInfo,
}: TicketCardHeaderProps) {
  const commentCount = ticket.comments?.length || 0;
  const attachmentCount = countTicketAttachments(ticket);

  const slaBadge = useMemo(() => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      if (ticket.resolutionBreachedAt) {
        return {
          label: 'SLA Breached',
          className: 'border-rose-400 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold',
          title: 'Resolution SLA was breached',
        };
      }
      return {
        label: 'SLA Met',
        className: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium',
        title: 'Resolved within SLA target',
      };
    }

    if (ticket.status === 'NEEDS_INFO') {
      return {
        label: '⏸ SLA Paused',
        className: 'border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium',
        title: 'SLA timer paused awaiting customer information',
      };
    }

    if (ticket.firstResponseBreachedAt || ticket.resolutionBreachedAt) {
      return {
        label: '⚠ SLA Breached',
        className: 'border-rose-500 bg-rose-600 text-white font-bold animate-pulse',
        title: 'Ticket has breached an SLA target deadline',
      };
    }

    if (ticket.firstResponseWarnedAt || ticket.resolutionWarnedAt) {
      return {
        label: '⏱ SLA Warning',
        className: 'border-amber-400 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-semibold',
        title: 'Ticket is approaching its SLA target deadline',
      };
    }

    if (!ticket.firstRespondedAt && ticket.firstResponseDueAt) {
      const rel = getRelativeTimeDisplay(ticket.firstResponseDueAt);
      return {
        label: `Resp: ${rel}`,
        className: 'border-spruce-300 dark:border-spruce-700 bg-spruce-100/80 dark:bg-spruce-800/80 text-spruce-800 dark:text-spruce-200',
        title: `First response target: ${new Date(ticket.firstResponseDueAt).toLocaleString()}`,
      };
    }

    if (!ticket.resolvedAt && ticket.resolutionDueAt) {
      const rel = getRelativeTimeDisplay(ticket.resolutionDueAt);
      return {
        label: `Resolve: ${rel}`,
        className: 'border-spruce-300 dark:border-spruce-700 bg-spruce-100/80 dark:bg-spruce-800/80 text-spruce-800 dark:text-spruce-200',
        title: `Resolution target: ${new Date(ticket.resolutionDueAt).toLocaleString()}`,
      };
    }

    return null;
  }, [ticket]);

  return (
    <CardHeader className="p-0">
      <div
        onClick={() => onToggleExpand(ticket.id)}
        className="w-full p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-t-xl hover:bg-spruce-50/50 dark:hover:bg-spruce-900/40 transition-colors cursor-pointer select-none"
      >
        {/* Left Side: Ticket ID, Title, Metadata */}
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-spruce-600 dark:text-spruce-400 shrink-0">
              {formatShortTicketId(ticket.id)}
            </span>

            <CardTitle
              className={`text-base sm:text-lg group-hover:text-spruce-700 dark:group-hover:text-spruce-200 transition-colors truncate ${
                !isViewed
                  ? 'font-bold text-spruce-950 dark:text-white'
                  : 'font-medium text-spruce-800 dark:text-spruce-300'
              }`}
            >
              {ticket.title}
            </CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-spruce-500 dark:text-spruce-400">
            <span>
              Reported by{' '}
              <strong className="font-semibold text-spruce-700 dark:text-spruce-300">
                {ticket.creator?.fullName || 'Customer'}
              </strong>
            </span>
            <span>·</span>
            <span>{formatTicketDate(ticket.createdAt)}</span>

            {showAssignee && (
              <>
                <span>·</span>
                <span className="inline-flex items-center flex-wrap gap-1">
                  Assignee:{' '}
                  <strong
                    className={`font-medium ${
                      ticket.assignee
                        ? 'text-spruce-700 dark:text-spruce-300'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {ticket.assignee?.fullName || 'Unassigned'}
                  </strong>
                  {ticket.assignee?.specialties && ticket.assignee.specialties.length > 0 && (
                    <span className="inline-flex items-center gap-1 ml-0.5">
                      {ticket.assignee.specialties.map((spec, i) => (
                        <span
                          key={i}
                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-spruce-200/70 dark:bg-spruce-800 text-spruce-800 dark:text-spruce-200 border border-spruce-300 dark:border-spruce-700"
                        >
                          {spec}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </>
            )}

            <span>·</span>
            <span>
              {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
            </span>

            {attachmentCount > 0 && (
              <>
                <span>·</span>
                <span className="text-spruce-700 dark:text-spruce-300 font-medium">
                  {attachmentCount} {attachmentCount === 1 ? 'attachment' : 'attachments'}
                </span>
              </>
            )}

            {slaInfo?.label && (
              <>
                <span>·</span>
                <span
                  className={
                    slaInfo.isBreached
                      ? 'text-rose-500 font-semibold'
                      : slaInfo.isResolved
                        ? 'text-emerald-500 font-medium'
                        : 'text-spruce-500'
                  }
                >
                  SLA: {slaInfo.label}
                </span>
              </>
            )}

            {typeof ticket.csatRating === 'number' && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300/80 dark:border-emerald-800 text-[11px]">
                  ★ CSAT {ticket.csatRating}.0
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Badges + Chevron Indicator */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-center">
          {ticket.autoEscalated && (
            <Badge
              variant="destructive"
              className="bg-red-600 hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-wider animate-pulse shadow-xs"
              title={ticket.escalationReason || 'Auto-escalated by high-severity keyword match'}
            >
              ⚡ AUTO-ESCALATED
            </Badge>
          )}

          {slaBadge && (
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${slaBadge.className}`}
              title={slaBadge.title}
            >
              {slaBadge.label}
            </span>
          )}

          <Badge
            variant="outline"
            className={`text-[11px] font-semibold ${
              ticket.department === 'GENERAL'
                ? 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200'
                : 'border-spruce-300 dark:border-spruce-700 bg-spruce-100/90 dark:bg-spruce-800/80 text-spruce-900 dark:text-spruce-200'
            }`}
          >
            {ticket.department === 'GENERAL' ? 'General Scope' : 'Tech Support'}
          </Badge>
          <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
            {ticket.priority}
          </Badge>
          <Badge variant={getStatusBadgeVariant(ticket.status)}>
            {ticket.status === 'NEEDS_INFO' ? 'NEEDS ADDITIONAL INFO' : ticket.status.replace('_', ' ')}
          </Badge>

          {/* Expand / Collapse Chevron */}
          <div
            className="p-1 rounded text-spruce-400 hover:text-spruce-700 dark:hover:text-spruce-200 transition-colors ml-1"
            aria-label={isExpanded ? 'Collapse ticket' : 'Expand ticket'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}
