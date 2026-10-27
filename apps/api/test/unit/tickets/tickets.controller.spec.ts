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

  it('should list tickets via findAll', async () => {
    service.findAll.mockResolvedValue([mockResponseDto]);

    const result = await controller.findAll('OPEN');

    expect(service.findAll).toHaveBeenCalledWith('OPEN');
    expect(result).toEqual([mockResponseDto]);
  });

  it('should retrieve a single ticket via findOne', async () => {
    service.findOne.mockResolvedValue(mockResponseDto);

    const result = await controller.findOne('ticket-1');

    expect(service.findOne).toHaveBeenCalledWith('ticket-1');
    expect(result).toEqual(mockResponseDto);
  });

  it('should create a new ticket via create', async () => {
    service.create.mockResolvedValue(mockResponseDto);

    const dto = {
      title: 'Billing Issue',
      description: 'Invoice calculation discrepancy',
      priority: 'HIGH' as const,
    };

    const result = await controller.create(dto as any);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponseDto);
  });

  it('should update an existing ticket via update', async () => {
    const updated = { ...mockResponseDto, status: 'RESOLVED' as const };
    service.update.mockResolvedValue(updated);

    const dto = { status: 'RESOLVED' as const };
    const result = await controller.update('ticket-1', dto as any);

    expect(service.update).toHaveBeenCalledWith('ticket-1', dto);
    expect(result).toEqual(updated);
  });

  it('should remove a ticket via remove', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('ticket-1');

    expect(service.remove).toHaveBeenCalledWith('ticket-1');
  });
});
