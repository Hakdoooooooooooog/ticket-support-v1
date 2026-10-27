import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { emailSchema } from '../../common/schemas/common.schema.js';

export const createInviteSchema = z.object({
  email: emailSchema.describe('Email address to invite'),
  role: z
    .enum(['AGENT', 'ADMIN'])
    .default('AGENT')
    .describe('Role for invited staff member (AGENT or ADMIN)'),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export class CreateInviteDto extends createZodDto(createInviteSchema) {}

export const adminCreateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .describe('Full name of staff member'),
  email: emailSchema.describe('Email address of staff member'),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .describe('Initial password for staff member'),
  role: z
    .enum(['AGENT', 'ADMIN'])
    .default('AGENT')
    .describe('Role for new staff member (AGENT or ADMIN)'),
});

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export class AdminCreateUserDto extends createZodDto(adminCreateUserSchema) {}

export const inviteResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['AGENT', 'ADMIN']),
  code: z.string(),
  accepted: z.boolean(),
  acceptedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  createdById: z.string(),
  createdBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
      email: z.string(),
    })
    .optional(),
});

export type InviteResponse = z.infer<typeof inviteResponseSchema>;
