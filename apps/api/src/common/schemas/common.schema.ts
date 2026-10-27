import { z } from 'zod';

/**
 * Shared transformation schema that safely converts Date instances, ISO strings,
 * or raw timestamps into a valid ISO-8601 string, defaulting to now() if missing or invalid.
 */
export const dateToIsoString = z
  .union([z.instanceof(Date), z.string()])
  .transform((val) => {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'string' && val.length > 0) {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    }
    return new Date().toISOString();
  });

/**
 * Standard normalized email schema (trimmed, lowercase, RFC-compliant).
 */
export const emailSchema = z
  .string()
  .trim()
  .email({ message: 'Must be a valid email address' })
  .transform((val) => val.toLowerCase());

/**
 * Helper to build trimmed string schemas with custom length constraints.
 */
export const trimmedString = (min = 1, max = 255, message?: string) =>
  z
    .string()
    .trim()
    .min(min, { message: message || `Must be at least ${min} characters` })
    .max(max, { message: `Cannot exceed ${max} characters` });
