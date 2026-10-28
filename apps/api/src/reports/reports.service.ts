import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { TicketActorContext } from '../tickets/tickets.service.js';

export interface ReportFilterOptions {
  status?: string;
  priority?: string;
  department?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  protected assertStaffAccess(actor?: TicketActorContext): void {
    if (actor && actor.role === 'CUSTOMER') {
      throw new ForbiddenException('Only staff members can access operational reports and exports');
    }
  }

  /**
   * Aggregates key helpdesk metrics, department volumes, CSAT distribution,
   * and per-agent resolution performance.
   */
  async getSummary(actor?: TicketActorContext) {
    this.assertStaffAccess(actor);

    const [
      tickets,
      agents,
    ] = await Promise.all([
      this.prisma.ticket.findMany({
        select: {
          id: true,
          status: true,
          priority: true,
          department: true,
          createdAt: true,
          assigneeId: true,
          csatRating: true,
          csatRatedAt: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          role: { in: ['AGENT', 'ADMIN'] },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          department: true,
          lastAssignedAt: true,
        },
        orderBy: [{ fullName: 'asc' }],
      }),
    ]);

    const totalTickets = tickets.length;
    const openTickets = tickets.filter((t) => t.status === 'OPEN').length;
    const inProgressTickets = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const needsInfoTickets = tickets.filter((t) => t.status === 'NEEDS_INFO').length;
    const resolvedTickets = tickets.filter((t) => t.status === 'RESOLVED').length;
    const closedTickets = tickets.filter((t) => t.status === 'CLOSED').length;

    const techSupportTickets = tickets.filter((t) => (t.department as string) === 'TECHNICAL_SUPPORT').length;
    const generalTickets = tickets.filter((t) => (t.department as string) === 'GENERAL').length;

    // CSAT calculations
    const ratedTickets = tickets.filter((t) => typeof t.csatRating === 'number' && t.csatRating > 0);
    const csatTotalRatings = ratedTickets.length;
    const csatSum = ratedTickets.reduce((acc, t) => acc + (t.csatRating || 0), 0);
    const csatAverage = csatTotalRatings > 0 ? Number((csatSum / csatTotalRatings).toFixed(1)) : null;

    const csatDistribution = {
      fiveStar: ratedTickets.filter((t) => t.csatRating === 5).length,
      fourStar: ratedTickets.filter((t) => t.csatRating === 4).length,
      threeStar: ratedTickets.filter((t) => t.csatRating === 3).length,
      twoStar: ratedTickets.filter((t) => t.csatRating === 2).length,
      oneStar: ratedTickets.filter((t) => t.csatRating === 1).length,
    };

    // Agent performance breakdown
    const agentStats = agents.map((agent) => {
      const assigned = tickets.filter((t) => t.assigneeId === agent.id);
      const resolved = assigned.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
      const agentRated = assigned.filter((t) => typeof t.csatRating === 'number' && t.csatRating > 0);
      const agentCsatSum = agentRated.reduce((acc, t) => acc + (t.csatRating || 0), 0);
      const agentCsatAvg = agentRated.length > 0 ? Number((agentCsatSum / agentRated.length).toFixed(1)) : null;

      return {
        id: agent.id,
        fullName: agent.fullName,
        email: agent.email,
        role: agent.role,
        department: agent.department || 'TECHNICAL_SUPPORT',
        lastAssignedAt: agent.lastAssignedAt ? agent.lastAssignedAt.toISOString() : null,
        assignedCount: assigned.length,
        resolvedCount: resolved.length,
        csatAverage: agentCsatAvg,
        csatRatingsCount: agentRated.length,
      };
    });

    return {
      kpis: {
        totalTickets,
        openTickets,
        inProgressTickets,
        needsInfoTickets,
        resolvedTickets,
        closedTickets,
        unassignedTickets: tickets.filter((t) => !t.assigneeId).length,
        resolutionRate: totalTickets > 0 ? Number(((resolvedTickets + closedTickets) / totalTickets * 100).toFixed(1)) : 0,
      },
      departments: {
        technicalSupport: techSupportTickets,
        general: generalTickets,
      },
      csat: {
        totalRatings: csatTotalRatings,
        average: csatAverage,
        distribution: csatDistribution,
      },
      agents: agentStats,
    };
  }

  /**
   * Generates formatted CSV for all tickets matching criteria.
   */
  async exportTicketsCsv(filters?: ReportFilterOptions, actor?: TicketActorContext): Promise<string> {
    this.assertStaffAccess(actor);

    const where: Record<string, unknown> = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.priority && filters.priority !== 'ALL') {
      where.priority = filters.priority;
    }
    if (filters?.department && filters.department !== 'ALL') {
      where.department = filters.department;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const tickets = await this.prisma.ticket.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'Ticket ID',
      'Title',
      'Department',
      'Priority',
      'Status',
      'Created At',
      'Updated At',
      'Customer Name',
      'Customer Email',
      'Assignee Name',
      'Assignee Email',
      'CSAT Rating',
      'CSAT Comment',
    ];

    const rows = tickets.map((t) => [
      escapeCsvField(t.id),
      escapeCsvField(t.title),
      escapeCsvField(t.department),
      escapeCsvField(t.priority),
      escapeCsvField(t.status),
      escapeCsvField(t.createdAt.toISOString()),
      escapeCsvField(t.updatedAt.toISOString()),
      escapeCsvField(t.creator?.fullName || 'Anonymous'),
      escapeCsvField(t.creator?.email || ''),
      escapeCsvField(t.assignee?.fullName || 'Unassigned'),
      escapeCsvField(t.assignee?.email || ''),
      escapeCsvField(t.csatRating !== null ? t.csatRating : ''),
      escapeCsvField(t.csatComment || ''),
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\r\n');

    return csvContent;
  }

  /**
   * Generates formatted CSV for CSAT customer survey feedback.
   */
  async exportCsatCsv(actor?: TicketActorContext): Promise<string> {
    this.assertStaffAccess(actor);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        csatRating: { not: null },
      },
      include: {
        creator: { select: { fullName: true, email: true } },
        assignee: { select: { fullName: true, email: true } },
      },
      orderBy: { csatRatedAt: 'desc' },
    });

    const headers = [
      'Ticket ID',
      'Title',
      'Department',
      'CSAT Rating',
      'Customer Feedback',
      'Rated At',
      'Customer Name',
      'Customer Email',
      'Resolved By Agent',
    ];

    const rows = tickets.map((t) => [
      escapeCsvField(t.id),
      escapeCsvField(t.title),
      escapeCsvField(t.department),
      escapeCsvField(t.csatRating),
      escapeCsvField(t.csatComment || ''),
      escapeCsvField(t.csatRatedAt ? t.csatRatedAt.toISOString() : ''),
      escapeCsvField(t.creator?.fullName || 'Customer'),
      escapeCsvField(t.creator?.email || ''),
      escapeCsvField(t.assignee?.fullName || 'Unassigned'),
    ]);

    const csvContent = [
      headers.map(escapeCsvField).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\r\n');

    return csvContent;
  }
}
