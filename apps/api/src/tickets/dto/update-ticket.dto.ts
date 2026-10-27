import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ticketPriorityEnum, encryptedAttachmentSchema } from './create-ticket.dto.js';

export const ticketStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'NEEDS_INFO',
  'RESOLVED',
  'CLOSED',
]);
export type TicketStatusType = z.infer<typeof ticketStatusEnum>;

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  NEEDS_INFO = 'NEEDS_INFO',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

// 1. Single source of truth for validation, type inference, and OpenAPI documentation
export const updateTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5)
    .max(100)
    .optional()
    .describe('Updated title of the ticket (5-100 characters)'),
  description: z
    .string()
    .trim()
    .min(10)
    .optional()
    .describe('Updated detailed description of the issue'),
  priority: ticketPriorityEnum
    .optional()
    .describe('Updated priority level: LOW, MEDIUM, HIGH, URGENT'),
  status: ticketStatusEnum
    .optional()
    .describe('Updated ticket status: OPEN, IN_PROGRESS, NEEDS_INFO, RESOLVED, CLOSED'),
  assigneeId: z
    .string()
    .nullable()
    .optional()
    .describe('Assigned IT agent User ID (or null to unassign)'),
  encryptedAttachment: encryptedAttachmentSchema
    .nullable()
    .optional()
    .describe('Optional image attachment to add/replace (or null to remove)'),
  amendmentNote: z
    .string()
    .trim()
    .min(2)
    .max(1000)
    .optional()
    .describe('Optional customer amendment summary or admin follow-up request note'),
  actorId: z
    .string()
    .optional()
    .describe('Optional User ID performing the amendment or follow-up request'),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class UpdateTicketDto extends createZodDto(updateTicketSchema) {}

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(2, { message: 'Comment must be at least 2 characters' })
    .describe('Comment or resolution note content'),
  authorId: z
    .string()
    .optional()
    .describe('Optional author User ID'),
  encryptedAttachment: encryptedAttachmentSchema
    .optional()
    .describe('Optional image attachment for this comment'),
});

export class CreateCommentDto extends createZodDto(createCommentSchema) {}
