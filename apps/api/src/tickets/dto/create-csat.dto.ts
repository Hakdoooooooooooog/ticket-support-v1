import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createCsatSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1 star').max(5, 'Rating cannot exceed 5 stars'),
  comment: z.string().max(1000, 'Feedback comment cannot exceed 1000 characters').nullable().optional(),
});

export class CreateCsatDto extends createZodDto(createCsatSchema) {}
