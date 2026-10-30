import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const auditActionEnum = z.enum([
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_ASSIGNED',
  'TICKET_DELETED',
  'TICKET_NOTE_POSTED',
  'TICKET_CSAT_SUBMITTED',
  'USER_CREATED',
  'USER_INVITED',
  'INVITE_REVOKED',
  'KB_ARTICLE_CREATED',
  'KB_ARTICLE_PUBLISHED',
  'KB_ARTICLE_ARCHIVED',
  'KB_ARTICLE_DELETED',
  'BANNER_CREATED',
  'BANNER_UPDATED',
  'BANNER_DELETED',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'AUTH_REFRESH_TOKEN_REUSE',
  'AUDIT_SETTINGS_UPDATED',
  'AUDIT_LOGS_PURGED',
]);

export const auditEntityTypeEnum = z.enum([
  'TICKET',
  'COMMENT',
  'USER',
  'INVITE',
  'ARTICLE',
  'BANNER',
  'AUTH',
  'SETTINGS',
]);

export const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export class AuditLogFilterDto extends createZodDto(auditLogFilterSchema) {}

export const updateAuditSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).nullable().describe('Number of days to retain logs (null for indefinite)'),
});

export class UpdateAuditSettingsDto extends createZodDto(updateAuditSettingsSchema) {}

export const auditLogResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorId: z.string().nullable().optional(),
  actorEmail: z.string(),
  actorRole: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  summary: z.string(),
  changes: z.any().nullable().optional(),
  ip: z.string().nullable().optional(),
});

export const auditLogPaginatedResponseSchema = z.object({
  data: z.array(auditLogResponseSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export class AuditLogPaginatedResponseDto extends createZodDto(auditLogPaginatedResponseSchema) {}
