import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from '../../../src/tickets/tickets.controller.js';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import { Reflector } from '@nestjs/core';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    addComment: ReturnType<typeof vi.fn>;
    submitCsat: ReturnType<typeof vi.fn>;
    getAttachment: ReturnType<typeof vi.fn>;
    getCommentAttachment: ReturnType<typeof vi.fn>;
  };

  const mockResponseDto = {
    id: 'ticket-1',
    title: 'Billing Issue',
    description: 'Invoice calculation discrepancy',
    status: 'OPEN' as const,
    priority: 'HIGH' as const,
    createdAt: '2026-10-27T10:00:00.000Z',
    updatedAt: '2026-10-27T10:00:00.000Z',
    creator: { id: 'u1', email: 'test@example.com', fullName: 'Test User', role: 'CUSTOMER' as const },
    assignee: null,
    comments: [],
    tags: [],
  };

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      addComment: vi.fn(),
      submitCsat: vi.fn(),
      getAttachment: vi.fn(),
      getCommentAttachment: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: service,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  describe('findAll', () => {
    it('should list tickets via findAll with filters and actor context', async () => {
      service.findAll.mockResolvedValue([mockResponseDto]);

      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };
      const result = await controller.findAll('OPEN', 'HIGH', 'billing', { user: actor });

      expect(service.findAll).toHaveBeenCalledWith('OPEN', {
        priority: 'HIGH',
        search: 'billing',
        actor,
      });
      expect(result).toEqual([mockResponseDto]);
    });

    it('should call default findAll when no filters provided', async () => {
      service.findAll.mockResolvedValue([mockResponseDto]);

      const result = await controller.findAll('OPEN');

      expect(service.findAll).toHaveBeenCalledWith('OPEN');
      expect(result).toEqual([mockResponseDto]);
    });
  });

  describe('findOne', () => {
    it('should retrieve a single ticket via findOne with actor context', async () => {
      service.findOne.mockResolvedValue(mockResponseDto);

      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };
      const result = await controller.findOne('ticket-1', { user: actor });

      expect(service.findOne).toHaveBeenCalledWith('ticket-1', actor);
      expect(result).toEqual(mockResponseDto);
    });
  });

  describe('create', () => {
    it('should create a new ticket passing actor context', async () => {
      service.create.mockResolvedValue(mockResponseDto);

      const dto = {
        title: 'Billing Issue',
        description: 'Invoice calculation discrepancy',
        priority: 'HIGH' as const,
      };

      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };
      const result = await controller.create(dto as any, { user: actor });

      expect(service.create).toHaveBeenCalledWith(dto, 'u1', actor);
      expect(result).toEqual(mockResponseDto);
    });
  });

  describe('update', () => {
    it('should update an existing ticket with actor context', async () => {
      const updated = { ...mockResponseDto, status: 'RESOLVED' as const };
      service.update.mockResolvedValue(updated);

      const dto = { status: 'RESOLVED' as const };
      const actor = { id: 'agent-1', email: 'agent@example.com', role: 'AGENT' as const };
      const result = await controller.update('ticket-1', dto as any, { user: actor });

      expect(service.update).toHaveBeenCalledWith('ticket-1', dto, actor);
      expect(result).toEqual(updated);
    });
  });

  describe('addComment', () => {
    it('should append resolution comment to ticket', async () => {
      service.addComment.mockResolvedValue(mockResponseDto);

      const dto = { content: 'Please verify the credentials' };
      const actor = { id: 'agent-1', email: 'agent@example.com', role: 'AGENT' as const };

      const result = await controller.addComment('ticket-1', dto as any, { user: actor });

      expect(service.addComment).toHaveBeenCalledWith(
        'ticket-1',
        'Please verify the credentials',
        undefined,
        undefined,
        actor,
        false,
      );
      expect(result).toEqual(mockResponseDto);
    });

    it('should forward isInternal to the service for private notes', async () => {
      service.addComment.mockResolvedValue(mockResponseDto);

      const dto = { content: 'Escalate quietly', isInternal: true };
      const actor = { id: 'agent-1', email: 'agent@example.com', role: 'AGENT' as const };

      await controller.addComment('ticket-1', dto as any, { user: actor });

      expect(service.addComment).toHaveBeenCalledWith(
        'ticket-1',
        'Escalate quietly',
        undefined,
        undefined,
        actor,
        true,
      );
    });
  });

  describe('submitCsat', () => {
    it('should submit CSAT feedback rating via service', async () => {
      const ratedDto = { ...mockResponseDto, csatRating: 5, csatComment: 'Great!' };
      service.submitCsat.mockResolvedValue(ratedDto);

      const dto = { rating: 5, comment: 'Great!' };
      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };

      const result = await controller.submitCsat('ticket-1', dto as any, { user: actor });

      expect(service.submitCsat).toHaveBeenCalledWith('ticket-1', dto, actor);
      expect(result).toEqual(ratedDto);
    });
  });

  describe('getAttachment & getCommentAttachment', () => {
    it('should retrieve root ticket attachment', async () => {
      const mockAttachment = {
        ticketId: 'ticket-1',
        fileName: 'screenshot.webp',
        mimeType: 'image/webp',
        originalSize: 1024,
        encrypted: { ciphertext: 'abc', iv: 'def' },
      };
      service.getAttachment.mockResolvedValue(mockAttachment);

      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };
      const result = await controller.getAttachment('ticket-1', { user: actor });

      expect(service.getAttachment).toHaveBeenCalledWith('ticket-1', actor);
      expect(result).toEqual(mockAttachment);
    });

    it('should retrieve comment attachment', async () => {
      const mockCommentAttachment = {
        ticketId: 'ticket-1',
        fileName: 'error.webp',
        mimeType: 'image/webp',
        originalSize: 2048,
        encrypted: { ciphertext: '123', iv: '456' },
      };
      service.getCommentAttachment.mockResolvedValue(mockCommentAttachment);

      const actor = { id: 'u1', email: 'test@example.com', role: 'CUSTOMER' as const };
      const result = await controller.getCommentAttachment('ticket-1', 'comm-1', { user: actor });

      expect(service.getCommentAttachment).toHaveBeenCalledWith('ticket-1', 'comm-1', actor);
      expect(result).toEqual(mockCommentAttachment);
    });
  });

  describe('remove', () => {
    it('should remove a ticket via remove with actor context', async () => {
      service.remove.mockResolvedValue(undefined);

      const actor = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
      await controller.remove('ticket-1', { user: actor });

      expect(service.remove).toHaveBeenCalledWith('ticket-1', actor);
    });
  });
});
