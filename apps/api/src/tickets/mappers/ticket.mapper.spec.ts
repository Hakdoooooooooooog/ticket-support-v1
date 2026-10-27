import { describe, it, expect } from 'vitest';
import { TicketMapper } from './ticket.mapper.js';

describe('TicketMapper', () => {
  it('should map incoming valid DTO to Prisma Create input with trimmed fields', () => {
    const rawDto = {
      title: '  VPN connectivity failure in office  ',
      description: '  Users cannot authenticate to internal VPN portal after restart  ',
      priority: 'HIGH',
    };

    const createInput = TicketMapper.toCreateInput(rawDto, 'user-123');

    expect(createInput.title).toBe('VPN connectivity failure in office');
    expect(createInput.description).toBe(
      'Users cannot authenticate to internal VPN portal after restart',
    );
    expect(createInput.priority).toBe('HIGH');
    expect(createInput.creatorId).toBe('user-123');
  });

  it('should populate default priority MEDIUM when omitted in create DTO', () => {
    const rawDto = {
      title: 'Valid Ticket Title',
      description: 'Valid Ticket Description of sufficient length',
    };

    const createInput = TicketMapper.toCreateInput(rawDto, 'user-123');
    expect(createInput.priority).toBe('MEDIUM');
  });

  it('should transform raw Prisma entity into sanitized response DTO and convert dates to ISO strings', () => {
    const rawPrismaRecord = {
      id: 'ticket_abc123',
      title: 'Server Alert',
      description: 'High memory usage',
      status: 'OPEN',
      priority: 'URGENT',
      createdAt: new Date('2026-10-27T10:00:00.000Z'),
      updatedAt: new Date('2026-10-27T10:30:00.000Z'),
      creator: {
        id: 'user_1',
        email: 'creator@example.com',
        fullName: 'Jane Doe',
        role: 'AGENT',
      },
    };

    const responseDto = TicketMapper.toResponseDto(rawPrismaRecord);

    expect(responseDto.id).toBe('ticket_abc123');
    expect(responseDto.createdAt).toBe('2026-10-27T10:00:00.000Z');
    expect(responseDto.updatedAt).toBe('2026-10-27T10:30:00.000Z');
    expect(responseDto.comments).toEqual([]);
    expect(responseDto.assignee).toBeNull();
  });

  it('should populate default values when missing fields are present in raw data', () => {
    const incompleteData = {
      title: 'Minimal Ticket',
      description: 'Detailed description for minimal ticket test',
    };

    const responseDto = TicketMapper.toResponseDto(incompleteData);

    expect(responseDto.status).toBe('OPEN');
    expect(responseDto.priority).toBe('MEDIUM');
    expect(responseDto.comments).toEqual([]);
    expect(responseDto.assignee).toBeNull();
    expect(typeof responseDto.createdAt).toBe('string');
  });
});
