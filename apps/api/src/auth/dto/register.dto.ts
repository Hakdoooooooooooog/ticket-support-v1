import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { emailSchema } from '../../common/schemas/common.schema.js';

// 1. Single source of truth for Validation AND Swagger documentation
export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' })
    .describe('User full name (minimum 2 characters)'),
  email: emailSchema.describe('User email address'),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .describe('User password (minimum 6 characters)'),
  role: z
    .enum(['ADMIN', 'AGENT', 'CUSTOMER'])
    .optional()
    .default('CUSTOMER')
    .describe('Requested account role (admin/agent requires valid inviteCode)'),
  inviteCode: z
    .string()
    .trim()
    .optional()
    .describe('Admin invite code for provisioning IT agent or administrator accounts'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class RegisterDto extends createZodDto(registerSchema) {}
