import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import { RealtimeService } from '../../../src/realtime/realtime.service.js';
import { TicketMapper } from '../../../src/tickets/mappers/ticket.mapper.js';
import { createCommentSchema } from '../../../src/tickets/dto/index.js';

const now = new Date('2026-10-27T10:00:00.000Z');
const agent = { id: 'agent-1', fullName: 'Agent A', email: 'a@x.io', role: 'AGENT' };
const author = (id: string, role: string) => ({ id, fullName: id, email: `${id}@x.io`, role });

const publicComment = {
  id: 'c-public',
  content: 'Public reply',
  isInternal: false,
  createdAt: now,
  author: author('agent-1', 'AGENT'),
};
const internalComment = {
  id: 'c-internal',
  content: 'Customer is a VIP, escalate quietly',
  isInternal: true,
  createdAt: now,
  author: author('agent-1', 'AGENT'),
};

const ticket = (comments: unknown[] = [publicComment, internalComment]) => ({
  id: 'ticket-1',
  title: 'VPN down',
  description: 'cannot connect',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  createdAt: now,
  updatedAt: now,
  creatorId: 'cust-1',
  creator: author('cust-1', 'CUSTOMER'),
  assigneeId: 'agent-1',
  assignee: author('agent-1', 'AGENT'),
  comments,
  tags: [],
});

describe('Internal notes', () => {
  let service: TicketsService;
  let prisma: any;
  let notifications: { createNotification: ReturnType<typeof vi.fn>; notifyAdmins: ReturnType<typeof vi.fn> };
  let realtime: { emit: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      ticket: { findUnique: vi.fn(), findMany: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue(agent) },
      comment: { create: vi.fn().mockResolvedValue({ id: 'c-new' }), findFirst: vi.fn() },
    };
    notifications = { createNotification: vi.fn(), notifyAdmins: vi.fn() };
    realtime = { emit: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();
    service = module.get(TicketsService);
  });

  describe('schemas', () => {
    it('createCommentSchema accepts isInternal and defaults to undefined', () => {
      expect(createCommentSchema.parse({ content: 'hello' }).isInternal).toBeUndefined();
      expect(createCommentSchema.parse({ content: 'hello', isInternal: true }).isInternal).toBe(true);
    });

    it('response DTO exposes isInternal on comments', () => {
      const dto = TicketMapper.toResponseDto(ticket());
      expect(dto.comments.map((c) => c.isInternal)).toEqual([false, true]);
    });
  });

  describe('visibility', () => {
    it('hides internal notes from CUSTOMERs in findOne', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      const result = await service.findOne('ticket-1', { id: 'cust-1', role: 'CUSTOMER' });
      expect(result.comments.map((c) => c.id)).toEqual(['c-public']);
    });

    it('hides internal notes from CUSTOMERs in findAll', async () => {
      prisma.ticket.findMany.mockResolvedValue([ticket()]);
      const [result] = await service.findAll('ALL', { actor: { id: 'cust-1', role: 'CUSTOMER' } });
      expect(result.comments.map((c) => c.id)).toEqual(['c-public']);
    });

    it('fails closed when no actor is supplied', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      const result = await service.findOne('ticket-1');
      expect(result.comments.map((c) => c.id)).toEqual(['c-public']);
    });

    it.each(['AGENT', 'ADMIN'] as const)('shows internal notes to %s', async (role) => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      const result = await service.findOne('ticket-1', { id: 'agent-1', role });
      expect(result.comments.map((c) => c.id)).toEqual(['c-public', 'c-internal']);
    });

    it('does not leak internal notes to CUSTOMERs via update', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      prisma.ticket.update = vi.fn().mockResolvedValue({ ...ticket(), status: 'CLOSED' });
      const result = await service.update('ticket-1', { status: 'CLOSED' } as any, {
        id: 'cust-1',
        role: 'CUSTOMER',
      });
      expect(JSON.stringify(result)).not.toContain('c-internal');
      expect(JSON.stringify(result)).not.toContain('escalate quietly');
    });

    it('does not leak internal notes to CUSTOMERs via submitCsat', async () => {
      const resolved = { ...ticket(), status: 'RESOLVED' };
      prisma.ticket.findUnique.mockResolvedValue(resolved);
      prisma.ticket.update = vi.fn().mockResolvedValue({ ...resolved, csatRating: 5 });
      const result = await service.submitCsat('ticket-1', { rating: 5 } as any, {
        id: 'cust-1',
        role: 'CUSTOMER',
      });
      expect(JSON.stringify(result)).not.toContain('c-internal');
      expect(JSON.stringify(result)).not.toContain('escalate quietly');
    });

    it('does not serve attachments of internal notes to CUSTOMERs', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ id: 'ticket-1', creatorId: 'cust-1' });
      prisma.comment.findFirst.mockResolvedValue(null);
      await expect(
        service.getCommentAttachment('ticket-1', 'c-internal', { id: 'cust-1', role: 'CUSTOMER' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.comment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'c-internal', ticketId: 'ticket-1', isInternal: false }),
        }),
      );
    });
  });

  describe('addComment with isInternal', () => {
    const actor = { id: 'agent-1', role: 'AGENT' as const };

    it('persists isInternal=true and defaults to false', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      await service.addComment('ticket-1', 'private note', undefined, undefined, actor, true);
      expect(prisma.comment.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ isInternal: true, content: 'private note' }),
      });

      await service.addComment('ticket-1', 'public note', undefined, undefined, actor);
      expect(prisma.comment.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ isInternal: false }),
      });
    });

    it('forbids CUSTOMERs from posting internal notes', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      await expect(
        service.addComment('ticket-1', 'sneaky', undefined, undefined, { id: 'cust-1', role: 'CUSTOMER' }, true),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('does not notify the customer or leak the note over realtime to the customer', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      await service.addComment('ticket-1', 'private note', undefined, undefined, actor, true);

      expect(notifications.createNotification).not.toHaveBeenCalled();
      const event = realtime.emit.mock.calls[0][0];
      expect(event.type).toBe('COMMENT_ADDED');
      expect(event.recipientRoles).toEqual(['ADMIN', 'AGENT']);
      expect(event.recipientUserIds ?? []).toEqual([]);
    });

    it('does not return internal notes to a CUSTOMER-visible response', async () => {
      prisma.ticket.findUnique.mockResolvedValue(ticket());
      const result = await service.addComment('ticket-1', 'private note', undefined, undefined, actor, true);
      expect(result.comments.some((c) => c.isInternal)).toBe(true); // staff actor sees it
    });
  });
});
