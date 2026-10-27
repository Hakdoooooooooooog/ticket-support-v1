import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticket: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  const mockDate = new Date('2026-10-27T10:00:00.000Z');

  const mockDbTicket = {
    id: 'ticket-1',
    title: 'VPN Connection Failure',
    description: 'Unable to connect to internal corporate network',
    status: 'OPEN',
    priority: 'HIGH',
    createdAt: mockDate,
    updatedAt: mockDate,
    creatorId: 'user-1',
    creator: {
      id: 'user-1',
      email: 'creator@example.com',
      fullName: 'Alice Walker',
      role: 'CUSTOMER',
    },
    assigneeId: null,
    assignee: null,
    comments: [],
    tags: [],
  };

  beforeEach(async () => {
    prisma = {
      ticket: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('findAll', () => {
    it('should return a list of mapped ticket DTOs', async () => {
      prisma.ticket.findMany.mockResolvedValue([mockDbTicket]);

      const result = await service.findAll();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ticket-1');
      expect(result[0].createdAt).toBe(mockDate.toISOString());
    });

    it('should apply status filter when provided', async () => {
      prisma.ticket.findMany.mockResolvedValue([mockDbTicket]);

      await service.findAll('OPEN');

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { status: 'OPEN' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the mapped ticket DTO when found', async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockDbTicket);

      const result = await service.findOne('ticket-1');

      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        include: expect.any(Object),
      });
      expect(result.title).toBe('VPN Connection Failure');
      expect(result.priority).toBe('HIGH');
    });

    it('should throw NotFoundException when ticket does not exist', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a ticket with creator user resolution and default priority', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'creator@example.com',
        fullName: 'Alice Walker',
        role: 'CUSTOMER',
      });
      prisma.ticket.create.mockResolvedValue(mockDbTicket);

      const dto = {
        title: 'New Support Incident',
        description: 'Detailed description of the issue encountered',
        priority: 'HIGH' as const,
      };

      const result = await service.create(dto as any, 'user-1');

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          title: 'New Support Incident',
          description: 'Detailed description of the issue encountered',
          priority: 'HIGH',
          creatorId: 'user-1',
        },
        include: expect.any(Object),
      });
      expect(result.id).toBe('ticket-1');
    });

    it('should upsert fallback demo customer if creatorId is not provided', async () => {
      prisma.user.upsert.mockResolvedValue({
        id: 'demo-user-id',
        email: 'demo@ticketsupport.com',
        fullName: 'Demo Customer',
        role: 'CUSTOMER',
      });
      prisma.ticket.create.mockResolvedValue({
        ...mockDbTicket,
        creatorId: 'demo-user-id',
      });

      const dto = {
        title: 'Anonymous Ticket Creation',
        description: 'Detailed description of an anonymous ticket',
      };

      await service.create(dto as any);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: 'demo@ticketsupport.com' },
        update: {},
        create: expect.objectContaining({ email: 'demo@ticketsupport.com' }),
      });
      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ creatorId: 'demo-user-id' }),
        include: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    it('should update ticket and return mapped response', async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockDbTicket);
      prisma.ticket.update.mockResolvedValue({
        ...mockDbTicket,
        status: 'RESOLVED',
      });

      const result = await service.update('ticket-1', { status: 'RESOLVED' } as any);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: 'RESOLVED' },
        include: expect.any(Object),
      });
      expect(result.status).toBe('RESOLVED');
    });

    it('should throw NotFoundException if updating non-existent ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { title: 'Updated Title' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete ticket when found', async () => {
      prisma.ticket.findUnique.mockResolvedValue(mockDbTicket);
      prisma.ticket.delete.mockResolvedValue(mockDbTicket);

      await service.remove('ticket-1');

      expect(prisma.ticket.delete).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
      });
    });

    it('should throw NotFoundException if deleting non-existent ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
