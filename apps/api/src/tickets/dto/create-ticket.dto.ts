import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ticketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TicketPriorityType = z.infer<typeof ticketPriorityEnum>;

export const departmentEnum = z.enum(['TECHNICAL_SUPPORT', 'GENERAL']);
export type DepartmentType = z.infer<typeof departmentEnum>;

export enum Department {
  TECHNICAL_SUPPORT = 'TECHNICAL_SUPPORT',
  GENERAL = 'GENERAL',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const encryptedAttachmentSchema = z.object({
  ciphertext: z.string().min(1).describe('Attachment payload'),
  iv: z.string().min(1).describe('Payload vector'),
  fileName: z.string().trim().min(1).max(255).describe('Attachment file name'),
  mimeType: z.string().trim().min(1).max(100).describe('Attachment MIME type'),
  originalSize: z.number().int().positive().optional().describe('Attachment byte size'),
});

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
  department: departmentEnum
    .default('TECHNICAL_SUPPORT')
    .describe('Department handling the issue: TECHNICAL_SUPPORT, GENERAL'),
  creatorId: z
    .string()
    .optional()
    .describe('Optional creator User ID'),
  encryptedAttachment: encryptedAttachmentSchema
    .optional()
    .describe('Optional image attachment'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class CreateTicketDto extends createZodDto(createTicketSchema) {}
