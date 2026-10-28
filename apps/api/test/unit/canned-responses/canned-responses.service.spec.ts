import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CannedResponsesService, INITIAL_DEFAULT_TEMPLATES } from '../../../src/canned-responses/canned-responses.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('CannedResponsesService', () => {
  let service: CannedResponsesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      cannedResponse: {
        count: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new CannedResponsesService(mockPrisma as unknown as PrismaService);
  });

  describe('onModuleInit', () => {
    it('seeds default templates if database has none', async () => {
      mockPrisma.cannedResponse.count.mockResolvedValue(0);
      mockPrisma.cannedResponse.create.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockPrisma.cannedResponse.count).toHaveBeenCalledTimes(1);
      expect(mockPrisma.cannedResponse.create).toHaveBeenCalledTimes(INITIAL_DEFAULT_TEMPLATES.length);
    });

    it('does not seed templates if count > 0', async () => {
      mockPrisma.cannedResponse.count.mockResolvedValue(5);

      await service.onModuleInit();

      expect(mockPrisma.cannedResponse.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns all canned response records mapped to response format', async () => {
      const mockRecords = [
        {
          id: 'cr-1',
          category: 'Troubleshooting',
          label: 'Power Cycle',
          content: 'Turn off and on',
          isSystem: true,
          createdById: null,
          createdAt: new Date('2026-10-27T00:00:00Z'),
          updatedAt: new Date('2026-10-27T00:00:00Z'),
        },
      ];
      mockPrisma.cannedResponse.findMany.mockResolvedValue(mockRecords);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cr-1');
      expect(result[0].category).toBe('Troubleshooting');
      expect(result[0].label).toBe('Power Cycle');
      expect(result[0].isSystem).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a new custom canned response template', async () => {
      const dto = {
        category: 'Custom',
        label: 'Custom Reply',
        content: 'Hello {{customer_name}}, this is custom.',
      };
      const createdRecord = {
        id: 'cr-new',
        ...dto,
        isSystem: false,
        createdById: 'admin-1',
        createdAt: new Date('2026-10-28T00:00:00Z'),
        updatedAt: new Date('2026-10-28T00:00:00Z'),
      };
      mockPrisma.cannedResponse.create.mockResolvedValue(createdRecord);

      const result = await service.create(dto, 'admin-1');
      expect(result.id).toBe('cr-new');
      expect(result.label).toBe('Custom Reply');
      expect(mockPrisma.cannedResponse.create).toHaveBeenCalledWith({
        data: {
          category: 'Custom',
          label: 'Custom Reply',
          content: 'Hello {{customer_name}}, this is custom.',
          createdById: 'admin-1',
        },
      });
    });
  });

  describe('update', () => {
    it('updates an existing canned response', async () => {
      const existing = {
        id: 'cr-1',
        category: 'Troubleshooting',
        label: 'Power Cycle',
        content: 'Old content',
        isSystem: false,
        createdById: 'admin-1',
        createdAt: new Date('2026-10-27T00:00:00Z'),
        updatedAt: new Date('2026-10-27T00:00:00Z'),
      };
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(existing);
      mockPrisma.cannedResponse.update.mockResolvedValue({
        ...existing,
        content: 'Updated content',
      });

      const result = await service.update('cr-1', { content: 'Updated content' });
      expect(result.content).toBe('Updated content');
    });

    it('throws NotFoundException if template does not exist', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', { label: 'New' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing template', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue({ id: 'cr-1' });
      mockPrisma.cannedResponse.delete.mockResolvedValue({ id: 'cr-1' });

      const result = await service.delete('cr-1');
      expect(result).toEqual({ success: true, id: 'cr-1' });
      expect(mockPrisma.cannedResponse.delete).toHaveBeenCalledWith({ where: { id: 'cr-1' } });
    });

    it('throws NotFoundException if trying to delete non-existent template', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
