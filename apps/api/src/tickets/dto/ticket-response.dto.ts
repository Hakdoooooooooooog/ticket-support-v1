import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { dateToIsoString } from '../../common/schemas/common.schema.js';
import { ticketPriorityEnum, departmentEnum } from './create-ticket.dto.js';
import { ticketStatusEnum } from './update-ticket.dto.js';

export const userSummarySchema = z.object({
  id: z.string().default('unknown-user'),
  email: z.string().default(''),
  fullName: z.string().default('Anonymous User'),
  role: z.enum(['ADMIN', 'AGENT', 'CUSTOMER']).default('CUSTOMER'),
  specialties: z.array(z.string()).default([]),
});

export const commentResponseSchema = z.object({
  id: z.string().default(''),
  content: z.string().default(''),
  isInternal: z.boolean().default(false),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
  author: userSummarySchema.nullable().default(null),
  hasAttachment: z.boolean().default(false),
  attachmentName: z.string().nullable().optional().default(null),
  attachmentMimeType: z.string().nullable().optional().default(null),
  attachmentOriginalSize: z.number().nullable().optional().default(null),
  attachmentStorageKey: z.string().nullable().optional().default(null),
  attachmentStorageType: z.string().nullable().optional().default(null),
});

export const ticketResponseSchema = z.object({
  id: z.string().default(''),
  title: z.string().default('Untitled Ticket'),
  description: z.string().default('No description provided'),
  status: ticketStatusEnum.default('OPEN'),
  priority: ticketPriorityEnum.default('MEDIUM'),
  department: departmentEnum.default('TECHNICAL_SUPPORT'),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
  updatedAt: dateToIsoString.default(() => new Date().toISOString()),
  creatorId: z.string().optional().default(''),
  creator: userSummarySchema.nullable().default(null),
  assigneeId: z.string().nullable().optional().default(null),
  assignee: userSummarySchema.nullable().default(null),
  hasAttachment: z.boolean().default(false),
  attachmentName: z.string().nullable().optional().default(null),
  attachmentMimeType: z.string().nullable().optional().default(null),
  attachmentOriginalSize: z.number().nullable().optional().default(null),
  attachmentStorageKey: z.string().nullable().optional().default(null),
  attachmentStorageType: z.string().nullable().optional().default(null),
  autoEscalated: z.boolean().default(false),
  escalationReason: z.string().nullable().optional().default(null),
  comments: z.array(commentResponseSchema).default([]),
  tags: z.array(z.any()).default([]),
  csatRating: z.number().int().min(1).max(5).nullable().optional().default(null),
  csatComment: z.string().nullable().optional().default(null),
  csatRatedAt: dateToIsoString.nullable().optional().default(null),
});

export class TicketResponseDto extends createZodDto(ticketResponseSchema) {}
export type TicketResponse = z.infer<typeof ticketResponseSchema>;
