import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { emailSchema } from '../../common/schemas/common.schema.js';

// 1. Single source of truth for Validation AND Swagger documentation
export const loginSchema = z.object({
  email: emailSchema.describe('User email address'),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .describe('User password'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// 2. Turns into a DTO usable in NestJS Controllers and visible in Swagger
export class LoginDto extends createZodDto(loginSchema) {}
