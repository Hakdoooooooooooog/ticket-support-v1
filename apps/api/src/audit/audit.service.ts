import {
  Injectable,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuditLogFilterDto,
  UpdateAuditSettingsDto,
} from './dto/audit-log.dto.js';

export interface AuditActorContext {
  id?: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  ip?: string;
}

export interface RecordAuditEntryInput {
  actorId?: string | null;
  actorEmail: string;
  actorRole: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

const REDACTED_KEYS = /^(password|passwordhash|token|refreshtoken|accesstoken|secret|apikey)$/i;

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (typeof this.prisma?.auditSettings?.upsert !== 'function') return;
    try {
      await this.prisma.auditSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton', retentionDays: null },
      });
    } catch {
      // Ignore during initial migrations or test setup
    }
  }

  /**
   * Sanitizes change tracking payload so credentials or sensitive secrets are never written.
   */
  sanitizeChanges(changes?: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!changes || typeof changes !== 'object') return null;
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(changes)) {
      if (REDACTED_KEYS.test(key)) {
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = this.sanitizeChanges(value as Record<string, unknown>);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  /**
   * Writes an immutable audit entry inside the provided interactive Prisma transaction client.
   */
  async record(tx: PrismaService, input: RecordAuditEntryInput) {
    const cleanChanges = this.sanitizeChanges(input.changes);

    return tx.auditLog.create({
      data: {
        actorId: input.actorId || null,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole as any,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        changes: cleanChanges as any,
        ip: input.ip || null,
      },
    });
  }

  /**
   * Admin-only retrieval of audit trails with filtering and pagination.
   */
  async findAll(filters: AuditLogFilterDto, actor?: { id: string; role: string }) {
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Audit trails are strictly restricted to administrators');
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.actorEmail) {
      where.actorEmail = { contains: filters.actorEmail, mode: 'insensitive' };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where: Object.keys(where).length ? where : undefined }),
      this.prisma.auditLog.findMany({
        where: Object.keys(where).length ? where : undefined,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: records.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getSettings(actor?: { role: string }) {
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Audit settings are restricted to administrators');
    }
    const settings = await this.prisma.auditSettings.findFirst({
      where: { id: 'singleton' },
    });
    return settings || { id: 'singleton', retentionDays: null };
  }

  async updateSettings(dto: UpdateAuditSettingsDto, actor: { id: string; email: string; role: string }) {
    if (!actor || actor.role !== 'ADMIN') {
      throw new ForbiddenException('Only administrators can update audit retention policies');
    }

    const before = await this.prisma.auditSettings.findFirst({ where: { id: 'singleton' } });
    const updated = await this.prisma.auditSettings.upsert({
      where: { id: 'singleton' },
      update: { retentionDays: dto.retentionDays },
      create: { id: 'singleton', retentionDays: dto.retentionDays },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: 'ADMIN',
        action: 'AUDIT_SETTINGS_UPDATED',
        entityType: 'SETTINGS',
        entityId: 'singleton',
        summary: `Audit retention policy updated to ${dto.retentionDays ? `${dto.retentionDays} days` : 'indefinite'}`,
        changes: {
          retentionDays: {
            from: before?.retentionDays ?? null,
            to: dto.retentionDays,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Purges audit logs older than configured retention period.
   * Executes inside a transaction setting `app.audit_purge = 'on'` to satisfy the DB immutability trigger.
   */
  async purgeOldLogs(): Promise<number> {
    const settings = await this.prisma.auditSettings.findFirst({ where: { id: 'singleton' } });
    if (!settings || !settings.retentionDays || settings.retentionDays <= 0) {
      return 0;
    }

    const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1. Authorize deletion specifically for this transaction block
      await tx.$executeRawUnsafe("SET LOCAL app.audit_purge = 'on'");

      // 2. Identify candidate logs
      const oldLogs = await tx.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: 5000,
      });

      if (oldLogs.length === 0) return 0;

      const ids = oldLogs.map((l) => l.id);

      // 3. Perform batch deletion
      await tx.auditLog.deleteMany({
        where: { id: { in: ids } },
      });

      // 4. Record summary of purge action
      await tx.auditLog.create({
        data: {
          actorEmail: 'system@ticketsupport.local',
          actorRole: 'ADMIN',
          action: 'AUDIT_LOGS_PURGED',
          entityType: 'SETTINGS',
          entityId: 'singleton',
          summary: `Retention compliance policy purged ${ids.length} audit records older than ${settings.retentionDays} days`,
          changes: { count: ids.length, cutoff: cutoff.toISOString() },
        },
      });

      return ids.length;
    });
  }
}
