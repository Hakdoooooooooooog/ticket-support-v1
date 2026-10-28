import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createCannedResponseSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, { message: 'Category is required' })
    .max(50)
    .describe('Category of canned response (e.g. Troubleshooting, Information Request, Resolution)'),
  label: z
    .string()
    .trim()
    .min(2, { message: 'Label must be at least 2 characters' })
    .max(100)
    .describe('Short descriptive label for menu dropdown'),
  content: z
    .string()
    .trim()
    .min(5, { message: 'Response template content must be at least 5 characters' })
    .describe('Text content of template, supporting dynamic {{placeholder}} variables'),
});

export type CreateCannedResponseInput = z.infer<typeof createCannedResponseSchema>;
export class CreateCannedResponseDto extends createZodDto(createCannedResponseSchema) {}

export const updateCannedResponseSchema = createCannedResponseSchema.partial();
export type UpdateCannedResponseInput = z.infer<typeof updateCannedResponseSchema>;
export class UpdateCannedResponseDto extends createZodDto(updateCannedResponseSchema) {}

export const cannedResponseResponseSchema = z.object({
  id: z.string(),
  category: z.string(),
  label: z.string(),
  content: z.string(),
  isSystem: z.boolean(),
  createdById: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CannedResponseResponse = z.infer<typeof cannedResponseResponseSchema>;
export class CannedResponseResponseDto extends createZodDto(cannedResponseResponseSchema) {}
