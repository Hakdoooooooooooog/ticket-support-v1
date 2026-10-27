import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { dateToIsoString } from '../../common/schemas/common.schema.js';

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

export class UserResponseDto extends createZodDto(userResponseSchema) {}
export class AuthResponseDto extends createZodDto(authResponseSchema) {}
