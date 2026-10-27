import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ticketPriorityEnum } from './create-ticket.dto.js';

export const ticketStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export type TicketStatusType = z.infer<typeof ticketStatusEnum>;

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
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
    .describe('Updated ticket status: OPEN, IN_PROGRESS, RESOLVED, CLOSED'),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class UpdateTicketDto extends createZodDto(updateTicketSchema) {}
