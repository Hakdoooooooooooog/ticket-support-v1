import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SlaService } from '../../../src/sla/sla.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import { AuditService } from '../../../src/audit/audit.service.js';
import { RealtimeService } from '../../../src/realtime/realtime.service.js';
import { TicketPriority, TicketStatus } from '@prisma/client';

describe('SlaService', () => {
  let service: SlaService;
  let prisma: any;
  let notificationsService: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      businessCalendar: {
        findFirst: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      slaPolicy: {
        findFirst: vi.fn(),
        createMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ticket: {
        update: vi.fn(),
        findMany: vi.fn(),
      },
      holiday: {
        upsert: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: 'admin-1', role: 'ADMIN' }]),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    notificationsService = {
      createNotification: vi.fn().mockResolvedValue({}),
    };

    auditService = {
      record: vi.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuditService, useValue: auditService },
        { provide: RealtimeService, useValue: { emit: vi.fn() } },
      ],
    }).compile();

    service = module.get<SlaService>(SlaService);
  });

  it('seeds default calendar and policies on module init if missing', async () => {
    prisma.businessCalendar.findFirst.mockResolvedValue(null);
    prisma.businessCalendar.create.mockResolvedValue({ id: 'cal-ph' });
    prisma.slaPolicy.count.mockResolvedValue(0);

    await service.onModuleInit();

    expect(prisma.businessCalendar.create).toHaveBeenCalled();
    expect(prisma.slaPolicy.createMany).toHaveBeenCalled();
  });

  it('pauses SLA clock when ticket transitions to NEEDS_INFO', async () => {
    const existing = {
      slaPausedAt: null,
      firstResponseDueAt: new Date('2026-05-04T12:00:00.000Z'),
      resolutionDueAt: new Date('2026-05-04T17:00:00.000Z'),
    };

    await service.handleStatusChange(
      'ticket-1',
      TicketStatus.OPEN,
      TicketStatus.NEEDS_INFO,
      existing,
      prisma,
    );

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          slaPausedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('resumes SLA clock and shifts due dates forward when leaving NEEDS_INFO', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const existing = {
      slaPausedAt: twoHoursAgo,
      firstResponseDueAt: new Date('2026-05-04T12:00:00.000Z'),
      resolutionDueAt: new Date('2026-05-04T17:00:00.000Z'),
    };

    await service.handleStatusChange(
      'ticket-1',
      TicketStatus.NEEDS_INFO,
      TicketStatus.IN_PROGRESS,
      existing,
      prisma,
    );

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          slaPausedAt: null,
          firstResponseDueAt: expect.any(Date),
          resolutionDueAt: expect.any(Date),
        }),
      }),
    );
  });

  it('stamps resolvedAt when ticket enters RESOLVED status', async () => {
    const existing = {
      resolvedAt: null,
    };

    await service.handleStatusChange(
      'ticket-1',
      TicketStatus.IN_PROGRESS,
      TicketStatus.RESOLVED,
      existing,
      prisma,
    );

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          resolvedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('stamps firstRespondedAt when staff public comment is added', async () => {
    await service.handleStaffPublicComment('ticket-1', null, prisma);

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          firstRespondedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not re-stamp firstRespondedAt if already stamped', async () => {
    const existing = new Date('2026-05-04T08:30:00.000Z');
    await service.handleStaffPublicComment('ticket-1', existing, prisma);

    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('sweeper detects breached SLA and triggers alert', async () => {
    const pastDue = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-1',
        title: 'Broken Laptop',
        status: TicketStatus.OPEN,
        priority: TicketPriority.URGENT,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        firstResponseDueAt: pastDue,
        firstRespondedAt: null,
        firstResponseBreachedAt: null,
        assigneeId: 'agent-1',
      },
    ]);

    prisma.slaPolicy.findFirst.mockResolvedValue({
      warnAtPercent: 75,
      is24x7: true,
      firstResponseMinutes: 30,
      resolutionMinutes: 240,
    });

    await service.sweepSlaDeadlines();

    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          firstResponseBreachedAt: expect.any(Date),
        }),
      }),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 'ticket-1',
        type: 'SLA_BREACHED',
      }),
    );
    expect(auditService.record).toHaveBeenCalled();
  });
});
