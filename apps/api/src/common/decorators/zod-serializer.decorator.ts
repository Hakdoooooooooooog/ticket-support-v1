import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';

export const ZOD_SERIALIZER_SCHEMA_KEY = 'ZOD_SERIALIZER_SCHEMA';

/**
 * Decorator to apply a Zod schema to serialize and sanitize controller endpoint responses.
 * Automatically strips sensitive properties, transforms dates, and injects default values for missing data.
 */
export const Serialize = (schema: ZodType) =>
  SetMetadata(ZOD_SERIALIZER_SCHEMA_KEY, schema);
