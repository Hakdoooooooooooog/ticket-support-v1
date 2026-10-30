'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { AuthUser, resolveTicketAssigneeId } from '@lib/helpers';
import type { Ticket } from '@components/ticket-list';

interface AdminAgentWorkloadProps {
  agents: AuthUser[];
  assignedTickets: Ticket[];
  currentUserId?: string;
  onViewAllAssigned: () => void;
  onSelectAgentQueue: (agentIdOrMine: string) => void;
}

export function AdminAgentWorkload({
  agents,
  assignedTickets,
  currentUserId,
  onViewAllAssigned,
  onSelectAgentQueue,
}: AdminAgentWorkloadProps) {
  if (agents.length === 0) return null;

  return (
    <Card className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-sm">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-200">
          IT Support Team Workload
        </CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onViewAllAssigned}
          className="h-7 text-xs text-spruce-700 dark:text-spruce-300 hover:text-spruce-950 dark:hover:text-white"
        >
          View All Assigned ({assignedTickets.length}) →
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const agentTickets = assignedTickets.filter(
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
                  <Badge
                    variant="secondary"
                    className="text-[10px] py-0 px-1.5 bg-spruce-200 text-spruce-900 dark:bg-spruce-800 dark:text-spruce-200 border border-spruce-300 dark:border-spruce-700"
                  >
                    {agent.role}
                  </Badge>
                </div>
                <p className="text-[11px] text-spruce-600 dark:text-spruce-300 flex items-center gap-1.5 pt-0.5">
                  <strong className="text-spruce-900 dark:text-spruce-100 font-semibold">
                    {activeCount} active
                  </strong>
                  <span className="text-spruce-400 dark:text-spruce-600">•</span>
                  <span className="text-emerald-600 dark:text-emerald-300 font-medium">
                    {resolvedCount} resolved
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onSelectAgentQueue(
                    currentUserId === agent.id ? 'MINE' : agent.id,
                  );
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
  );
}
