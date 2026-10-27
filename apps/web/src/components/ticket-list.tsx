'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Badge } from '@ui/badge';
import { API_BASE_URL } from '@lib/constants';
import { getPriorityBadgeVariant, getStatusBadgeVariant } from '@lib/badge-utils';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  creator?: {
    fullName: string;
    email: string;
  };
}

export function TicketList() {
  const { data: tickets, isLoading, isError, refetch } = useQuery<Ticket[]>({
    queryKey: ['tickets'],
    queryFn: async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/tickets`);
        return res.data;
      } catch {
        return [];
      }
    },
  });

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight">Active Tickets</h2>
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-500 hover:text-slate-800 underline dark:text-slate-400"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="p-8 text-center text-sm text-slate-500">Loading tickets...</div>
      )}

      {isError && (
        <div className="p-4 rounded-md text-sm bg-amber-50 text-amber-800 border border-amber-200">
          Backend API is offline or unreachable at port 3001. Start the NestJS backend to sync live tickets.
        </div>
      )}

      {!isLoading && tickets?.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            No tickets found. Submit your first ticket using the form above!
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        tickets &&
        tickets.map((ticket) => (
          <Card key={ticket.id} className="transition-all hover:border-slate-400">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold leading-snug">
                  {ticket.title}
                </CardTitle>
                <div className="flex gap-1.5 shrink-0">
                  <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(ticket.status)}>
                    {ticket.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                {ticket.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>By: {ticket.creator?.fullName || 'Anonymous'}</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
