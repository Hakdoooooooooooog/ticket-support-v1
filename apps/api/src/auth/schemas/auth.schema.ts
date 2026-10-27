import { z } from 'zod';
import { dateToIsoString, emailSchema } from '../../common/schemas/common.schema.js';

// ==============================================================================
// Input Schemas (HTTP Request -> Validated Input DTO)
// ==============================================================================

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Full name must be at least 2 characters' }),
  email: emailSchema,
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ==============================================================================
// Output / Response Schemas (Sanitizes raw Prisma User and strips passwordHash)
// ==============================================================================

export const userResponseSchema = z.object({
  id: z.string().default(''),
  email: z.string().default(''),
  fullName: z.string().default('User'),
  role: z.enum(['ADMIN', 'AGENT', 'CUSTOMER']).default('CUSTOMER'),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
});

export const authResponseSchema = z.object({
  accessToken: z.string().default(''),
  user: userResponseSchema,
  message: z.string().optional().default('Success'),
});

export type UserResponseDto = z.infer<typeof userResponseSchema>;
export type AuthResponseDto = z.infer<typeof authResponseSchema>;
