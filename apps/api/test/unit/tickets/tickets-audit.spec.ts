import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { AuditService } from '../../../src/audit/audit.service.js';

describe('TicketsService - Audit Integration', () => {
  let service: TicketsService;
  let prisma: any;
  let auditService: { record: ReturnType<typeof vi.fn> };

  const mockDate = new Date('2026-10-30T10:00:00.000Z');
  const mockUser = {
    id: 'user-1',
    email: 'user1@example.com',
    fullName: 'Jane Customer',
    role: 'CUSTOMER',
  };

  const mockDbTicket = {
    id: 'ticket-1',
    title: 'VPN Issue',
    description: 'VPN failure',
    status: 'OPEN',
    priority: 'HIGH',
    department: 'TECHNICAL_SUPPORT',
    createdAt: mockDate,
    updatedAt: mockDate,
    creatorId: 'user-1',
    creator: mockUser,
    assigneeId: 'admin-1',
    assignee: { id: 'admin-1', fullName: 'Alex Rivera', email: 'admin@example.com', role: 'ADMIN' },
    comments: [],
    tags: [],
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        findUnique: vi.fn().mockResolvedValue(mockDbTicket),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockDbTicket),
        update: vi.fn().mockResolvedValue({ ...mockDbTicket, status: 'IN_PROGRESS' }),
        delete: vi.fn().mockResolvedValue(mockDbTicket),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        update: vi.fn().mockResolvedValue(mockUser),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      comment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'c-1', content: 'note' }),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    auditService = {
      record: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('records an audit entry when a ticket is created', async () => {
    const actor = { id: 'user-1', email: 'user1@example.com', role: 'CUSTOMER' as const };
    await service.create(
      {
        title: 'VPN Issue',
        description: 'VPN failure',
        priority: 'HIGH',
        department: 'TECHNICAL_SUPPORT',
      } as any,
      'user-1',
      actor,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'TICKET_CREATED',
        entityType: 'TICKET',
        entityId: 'ticket-1',
        actorEmail: 'user1@example.com',
        actorRole: 'CUSTOMER',
      }),
    );
  });

  it('records an audit entry with field changes when a ticket is updated', async () => {
    const actor = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
    await service.update(
      'ticket-1',
      { status: 'IN_PROGRESS' } as any,
      actor,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'TICKET_UPDATED',
        entityType: 'TICKET',
        entityId: 'ticket-1',
        actorEmail: 'admin@example.com',
        actorRole: 'ADMIN',
        changes: expect.objectContaining({
          status: { from: 'OPEN', to: 'IN_PROGRESS' },
        }),
      }),
    );
  });

  it('records an audit entry when a ticket is deleted by admin', async () => {
    const actor = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
    await service.remove('ticket-1', actor);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'TICKET_DELETED',
        entityType: 'TICKET',
        entityId: 'ticket-1',
        actorEmail: 'admin@example.com',
      }),
    );
  });
});
