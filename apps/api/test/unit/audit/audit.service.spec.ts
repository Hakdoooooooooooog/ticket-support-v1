import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from '../../../src/audit/audit.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    auditSettings: {
      findFirst: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
  };

  const mockDate = new Date('2026-10-30T10:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditSettings: {
        findFirst: vi.fn(),
        upsert: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
      $executeRawUnsafe: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('record', () => {
    it('creates an audit log entry in transaction with caller snapshot data', async () => {
      const entry = {
        actorId: 'user-admin-1',
        actorEmail: 'admin@example.com',
        actorRole: 'ADMIN' as const,
        action: 'TICKET_STATUS_CHANGED',
        entityType: 'TICKET',
        entityId: 'ticket-1',
        summary: 'Ticket status changed from OPEN to IN_PROGRESS',
        changes: { status: { from: 'OPEN', to: 'IN_PROGRESS' } },
      };

      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1', ...entry, createdAt: mockDate });

      await service.record(prisma as any, entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'user-admin-1',
          actorEmail: 'admin@example.com',
          actorRole: 'ADMIN',
          action: 'TICKET_STATUS_CHANGED',
          entityType: 'TICKET',
          entityId: 'ticket-1',
          summary: 'Ticket status changed from OPEN to IN_PROGRESS',
          changes: { status: { from: 'OPEN', to: 'IN_PROGRESS' } },
          ip: null,
        },
      });
    });

    it('sanitizes changes JSON to never persist sensitive keys', async () => {
      const entry = {
        actorEmail: 'admin@example.com',
        actorRole: 'ADMIN' as const,
        action: 'USER_PASSWORD_RESET',
        entityType: 'USER',
        entityId: 'user-2',
        summary: 'Password reset',
        changes: {
          passwordHash: 'secret_hash_value',
          token: 'jwt_token_sample',
          email: 'user2@example.com',
        },
      };

      await service.record(prisma as any, entry);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changes: {
            email: 'user2@example.com',
          },
        }),
      });
    });
  });

  describe('findAll', () => {
    it('throws ForbiddenException if non-admin queries audit logs', async () => {
      await expect(
        service.findAll({ page: 1, limit: 10 }, { id: 'agent-1', role: 'AGENT' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.findAll({ page: 1, limit: 10 }, { id: 'cust-1', role: 'CUSTOMER' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns paginated audit logs for admin actor', async () => {
      const logs = [
        {
          id: 'log-1',
          action: 'TICKET_CREATED',
          entityType: 'TICKET',
          entityId: 'ticket-1',
          actorEmail: 'admin@example.com',
          actorRole: 'ADMIN',
          summary: 'Created ticket',
          changes: null,
          createdAt: mockDate,
        },
      ];
      prisma.auditLog.findMany.mockResolvedValue(logs);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, action: 'TICKET_CREATED' },
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('settings & retention purge', () => {
    it('updates retention settings when admin calls updateSettings', async () => {
      prisma.auditSettings.upsert.mockResolvedValue({ id: 'settings-1', retentionDays: 90 });

      const updated = await service.updateSettings(
        { retentionDays: 90 },
        { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
      );

      expect(updated.retentionDays).toBe(90);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AUDIT_SETTINGS_UPDATED',
          }),
        }),
      );
    });

    it('executes retention purge with transaction local flag to satisfy DB trigger', async () => {
      prisma.auditSettings.findFirst.mockResolvedValue({ retentionDays: 30 });
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'old-log-1' }]);

      const count = await service.purgeOldLogs();

      expect(count).toBe(1);
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("SET LOCAL app.audit_purge = 'on'"),
      );
    });
  });
});
