import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const incidentSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL']);

export const createIncidentBannerSchema = z.object({
  title: z.string().trim().min(3).max(120).describe('Headline of the incident or maintenance'),
  message: z.string().trim().min(5).max(1000).describe('Detailed status message for users'),
  severity: incidentSeverityEnum.default('WARNING').describe('Severity level: INFO, WARNING, CRITICAL'),
  isActive: z.boolean().default(true).describe('Whether the banner is actively broadcast'),
  affectedServices: z.array(z.string()).default([]).describe('List of affected system components or services'),
});

export class CreateIncidentBannerDto extends createZodDto(createIncidentBannerSchema) {}

export const updateIncidentBannerSchema = createIncidentBannerSchema.partial();
export class UpdateIncidentBannerDto extends createZodDto(updateIncidentBannerSchema) {}
