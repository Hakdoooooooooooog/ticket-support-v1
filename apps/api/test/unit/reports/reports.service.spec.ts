import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService, escapeCsvField } from '../../../src/reports/reports.service.js';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    ticket: {
      findMany: ReturnType<typeof vi.fn>;
    };
    user: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockDate = new Date('2026-10-28T10:00:00.000Z');

  const mockTickets = [
    {
      id: 'ticket-1',
      title: 'Server Outage',
      status: 'RESOLVED',
      priority: 'HIGH',
      department: 'TECHNICAL_SUPPORT',
      createdAt: mockDate,
      updatedAt: mockDate,
      assigneeId: 'agent-1',
      creator: { id: 'u1', fullName: 'Alice Customer', email: 'alice@example.com' },
      assignee: { id: 'agent-1', fullName: 'Agent Bob', email: 'bob@ticketsupport.local' },
      csatRating: 5,
      csatComment: 'Fast fix!',
      csatRatedAt: mockDate,
    },
    {
      id: 'ticket-2',
      title: 'General Question',
      status: 'OPEN',
      priority: 'LOW',
      department: 'GENERAL',
      createdAt: mockDate,
      updatedAt: mockDate,
      assigneeId: null,
      creator: { id: 'u2', fullName: 'Charlie Customer', email: 'charlie@example.com' },
      assignee: null,
      csatRating: null,
      csatComment: null,
      csatRatedAt: null,
    },
  ];

  const mockAgents = [
    {
      id: 'agent-1',
      fullName: 'Agent Bob',
      email: 'bob@ticketsupport.local',
      role: 'AGENT',
      department: 'TECHNICAL_SUPPORT',
      lastAssignedAt: mockDate,
    },
  ];

  beforeEach(() => {
    prisma = {
      ticket: {
        findMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
    };

    service = new ReportsService(prisma as any);
  });

  describe('getSummary', () => {
    it('should aggregate metrics, department volumes, and CSAT breakdown', async () => {
      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.user.findMany.mockResolvedValue(mockAgents);

      const summary = await service.getSummary({ id: 'staff-1', role: 'ADMIN' });

      expect(summary.kpis.totalTickets).toBe(2);
      expect(summary.kpis.resolvedTickets).toBe(1);
      expect(summary.kpis.openTickets).toBe(1);
      expect(summary.departments.technicalSupport).toBe(1);
      expect(summary.departments.general).toBe(1);
      expect(summary.csat.totalRatings).toBe(1);
      expect(summary.csat.average).toBe(5);
      expect(summary.agents.length).toBe(1);
      expect(summary.agents[0].fullName).toBe('Agent Bob');
      expect(summary.agents[0].resolvedCount).toBe(1);
    });

    it('should throw ForbiddenException if a CUSTOMER accesses reports', async () => {
      await expect(
        service.getSummary({ id: 'cust-1', role: 'CUSTOMER' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exportTicketsCsv', () => {
    it('should format CSV with correct headers and escaped fields', async () => {
      prisma.ticket.findMany.mockResolvedValue(mockTickets);

      const csv = await service.exportTicketsCsv(
        { department: 'TECHNICAL_SUPPORT' },
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(csv).toContain('"Ticket ID","Title","Department","Priority","Status"');
      expect(csv).toContain('"ticket-1","Server Outage","TECHNICAL_SUPPORT","HIGH","RESOLVED"');
      expect(csv).toContain('"Alice Customer"');
      expect(csv).toContain('"Fast fix!"');
    });

    it('should escape internal double quotes according to RFC 4180', () => {
      expect(escapeCsvField('Hello "World"')).toBe('"Hello ""World"""');
      expect(escapeCsvField(null)).toBe('""');
    });
  });

  describe('exportCsatCsv', () => {
    it('should export only tickets with CSAT ratings', async () => {
      prisma.ticket.findMany.mockResolvedValue([mockTickets[0]]);

      const csv = await service.exportCsatCsv({ id: 'agent-1', role: 'AGENT' });

      expect(csv).toContain('"Ticket ID","Title","Department","CSAT Rating"');
      expect(csv).toContain('"ticket-1","Server Outage","TECHNICAL_SUPPORT","5","Fast fix!"');
    });
  });
});
