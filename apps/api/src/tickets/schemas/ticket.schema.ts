import { z } from 'zod';
import { dateToIsoString } from '../../common/schemas/common.schema.js';

export const ticketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const ticketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export type TicketPriorityType = z.infer<typeof ticketPriorityEnum>;
export type TicketStatusType = z.infer<typeof ticketStatusEnum>;

// ==============================================================================
// Input Schemas (Raw Request -> Validated Input DTO)
// ==============================================================================

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(100, { message: 'Title cannot exceed 100 characters' }),
  description: z
    .string()
    .trim()
    .min(10, { message: 'Description must be at least 10 characters long' }),
  priority: ticketPriorityEnum.default('MEDIUM'),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(5).max(100).optional(),
  description: z.string().trim().min(10).optional(),
  priority: ticketPriorityEnum.optional(),
  status: ticketStatusEnum.optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// ==============================================================================
// Output / Response Schemas (Raw Prisma Database Entity -> Sanitized Response DTO)
// ==============================================================================

export const userSummarySchema = z.object({
  id: z.string().default('unknown-user'),
  email: z.string().default(''),
  fullName: z.string().default('Anonymous User'),
  role: z.enum(['ADMIN', 'AGENT', 'CUSTOMER']).default('CUSTOMER'),
});

export const commentResponseSchema = z.object({
  id: z.string().default(''),
  content: z.string().default(''),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
  author: userSummarySchema.nullable().default(null),
});

export const ticketResponseSchema = z.object({
  id: z.string().default(''),
  title: z.string().default('Untitled Ticket'),
  description: z.string().default('No description provided'),
  status: ticketStatusEnum.default('OPEN'),
  priority: ticketPriorityEnum.default('MEDIUM'),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
  updatedAt: dateToIsoString.default(() => new Date().toISOString()),
  creatorId: z.string().optional().default(''),
  creator: userSummarySchema.nullable().default(null),
  assigneeId: z.string().nullable().optional().default(null),
  assignee: userSummarySchema.nullable().default(null),
  comments: z.array(commentResponseSchema).default([]),
  tags: z.array(z.any()).default([]),
});

export type TicketResponseDto = z.infer<typeof ticketResponseSchema>;
