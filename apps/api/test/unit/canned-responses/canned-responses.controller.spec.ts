import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CannedResponsesController } from '../../../src/canned-responses/canned-responses.controller.js';
import { CannedResponsesService } from '../../../src/canned-responses/canned-responses.service.js';

describe('CannedResponsesController', () => {
  let controller: CannedResponsesController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    controller = new CannedResponsesController(mockService as unknown as CannedResponsesService);
  });

  describe('findAll', () => {
    it('calls service.findAll and returns items', async () => {
      mockService.findAll.mockResolvedValue([{ id: '1', label: 'Test' }]);
      const result = await controller.findAll();
      expect(result).toHaveLength(1);
      expect(mockService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('creates canned response if user is ADMIN', async () => {
      const dto = { category: 'Test', label: 'Test', content: 'Test Content' };
      const req = { user: { id: 'admin-1', role: 'ADMIN' } };
      mockService.create.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.create(dto, req);
      expect(result.id).toBe('1');
      expect(mockService.create).toHaveBeenCalledWith(dto, 'admin-1');
    });

    it('throws ForbiddenException if user is not ADMIN', async () => {
      const dto = { category: 'Test', label: 'Test', content: 'Test Content' };
      const req = { user: { id: 'agent-1', role: 'AGENT' } };

      await expect(controller.create(dto, req)).rejects.toThrow(ForbiddenException);
      expect(mockService.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates canned response if user is ADMIN', async () => {
      const dto = { label: 'Updated Label' };
      const req = { user: { id: 'admin-1', role: 'ADMIN' } };
      mockService.update.mockResolvedValue({ id: '1', label: 'Updated Label' });

      const result = await controller.update('1', dto, req);
      expect(result.label).toBe('Updated Label');
      expect(mockService.update).toHaveBeenCalledWith('1', dto);
    });

    it('throws ForbiddenException if non-admin attempts update', async () => {
      const dto = { label: 'Updated Label' };
      const req = { user: { id: 'agent-1', role: 'AGENT' } };

      await expect(controller.update('1', dto, req)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('deletes canned response if user is ADMIN', async () => {
      const req = { user: { id: 'admin-1', role: 'ADMIN' } };
      mockService.delete.mockResolvedValue({ success: true, id: '1' });

      const result = await controller.delete('1', req);
      expect(result).toEqual({ success: true, id: '1' });
      expect(mockService.delete).toHaveBeenCalledWith('1');
    });

    it('throws ForbiddenException if non-admin attempts delete', async () => {
      const req = { user: { id: 'agent-1', role: 'AGENT' } };

      await expect(controller.delete('1', req)).rejects.toThrow(ForbiddenException);
    });
  });
});
