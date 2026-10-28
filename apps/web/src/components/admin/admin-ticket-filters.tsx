'use client';

import * as React from 'react';
import { Card, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { AuthUser, resolveTicketAssigneeId } from '@lib/helpers';
import type { Ticket } from '@components/ticket-list';

interface AdminTicketFiltersProps {
  mode: 'ALL_TICKETS' | 'ASSIGNED_TICKETS';
  statusFilter: string;
  onSelectStatus: (status: string) => void;
  priorityFilter: string;
  onSelectPriority: (priority: string) => void;
  departmentFilter?: string;
  onSelectDepartment?: (dept: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // ALL_TICKETS mode props
  assignmentFilter?: 'ALL' | 'UNASSIGNED' | 'ASSIGNED';
  onSelectAssignment?: (filter: 'ALL' | 'UNASSIGNED' | 'ASSIGNED') => void;
  totalCount?: number;
  unassignedCount?: number;
  allAssignedCount?: number;

  // ASSIGNED_TICKETS mode props
  assignedScope?: string;
  onSelectAssignedScope?: (scope: string) => void;
  agents?: AuthUser[];
  currentUserId?: string;
  myAssignedCount?: number;
  allTickets?: Ticket[];
}

export function AdminTicketFilters({
  mode,
  statusFilter,
  onSelectStatus,
  priorityFilter,
  onSelectPriority,
  departmentFilter = 'ALL',
  onSelectDepartment,
  searchQuery,
  onSearchChange,
  assignmentFilter = 'ALL',
  onSelectAssignment,
  totalCount = 0,
  unassignedCount = 0,
  allAssignedCount = 0,
  assignedScope = 'MINE',
  onSelectAssignedScope,
  agents = [],
  currentUserId,
  myAssignedCount = 0,
  allTickets = [],
}: AdminTicketFiltersProps) {
  const statuses = ['ALL', 'OPEN', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'CLOSED'] as const;

  return (
    <Card className="border-spruce-200 dark:border-spruce-800 bg-spruce-100/50 dark:bg-spruce-950/70 shadow-xs">
      <CardContent className="p-4 flex flex-col gap-3">
        {mode === 'ASSIGNED_TICKETS' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-spruce-100 dark:border-spruce-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={assignedScope === 'MINE' ? 'default' : 'outline'}
                onClick={() => onSelectAssignedScope?.('MINE')}
                className="text-xs"
              >
                Assigned to Me ({myAssignedCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={assignedScope === 'ALL_ASSIGNED' ? 'default' : 'outline'}
                onClick={() => onSelectAssignedScope?.('ALL_ASSIGNED')}
                className="text-xs"
              >
                All Assigned Tickets ({allAssignedCount})
              </Button>
              {agents
                .filter((a) => a.id !== currentUserId)
                .map((agent) => {
                  const count = allTickets.filter(
                    (t) => resolveTicketAssigneeId(t) === agent.id,
                  ).length;
                  return (
                    <Button
                      key={agent.id}
                      type="button"
                      size="sm"
                      variant={assignedScope === agent.id ? 'default' : 'ghost'}
                      onClick={() => onSelectAssignedScope?.(agent.id)}
                      className="text-xs"
                    >
                      {agent.fullName} ({count})
                    </Button>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => onSelectStatus(status)}
                className="text-xs"
              >
                {status.replace('_', ' ')}
              </Button>
            ))}
          </div>

          {/* Assignment Tabs (Only for ALL_TICKETS mode) */}
          {mode === 'ALL_TICKETS' && onSelectAssignment && (
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `All (${totalCount})` },
                  { id: 'UNASSIGNED', label: `Unassigned (${unassignedCount})` },
                  { id: 'ASSIGNED', label: `Assigned (${allAssignedCount})` },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={assignmentFilter === tab.id ? 'secondary' : 'ghost'}
                  onClick={() => onSelectAssignment(tab.id)}
                  className="h-8 text-xs"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Department + Priority Filter + Search Input */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-2 border-t border-spruce-100 dark:border-spruce-800">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by Department"
              value={departmentFilter}
              onChange={(e) => onSelectDepartment?.(e.target.value)}
              className="h-9 rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
            >
              <option value="ALL">All Departments</option>
              <option value="TECHNICAL_SUPPORT">Tech Support</option>
              <option value="GENERAL">General Scope</option>
            </select>

            <select
              aria-label="Filter by Priority"
              value={priorityFilter}
              onChange={(e) => onSelectPriority(e.target.value)}
              className="h-9 rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-1 focus:ring-spruce-500 dark:border-spruce-700/80 dark:bg-spruce-950 dark:text-spruce-100 dark:focus:ring-spruce-300"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent Only</option>
              <option value="HIGH">High Only</option>
              <option value="MEDIUM">Medium Only</option>
              <option value="LOW">Low Only</option>
            </select>
          </div>

          <Input
            placeholder={
              mode === 'ALL_TICKETS'
                ? 'Search all tickets by #ID, title, description, or customer...'
                : 'Search assigned tickets by #ID, title, or customer...'
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:w-80 text-xs h-9"
          />
        </div>
      </CardContent>
    </Card>
  );
}
