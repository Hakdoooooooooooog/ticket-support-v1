import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ticketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TicketPriorityType = z.infer<typeof ticketPriorityEnum>;

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// 1. Single source of truth for validation, type inference, and OpenAPI documentation
export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, { message: 'Title must be at least 5 characters long' })
    .max(100, { message: 'Title cannot exceed 100 characters' })
    .describe('Title of the ticket (5-100 characters)'),
  description: z
    .string()
    .trim()
    .min(10, { message: 'Description must be at least 10 characters long' })
    .describe('Detailed description of the issue (min 10 characters)'),
  priority: ticketPriorityEnum
    .default('MEDIUM')
    .describe('Priority level: LOW, MEDIUM, HIGH, URGENT'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class CreateTicketDto extends createZodDto(createTicketSchema) {}
