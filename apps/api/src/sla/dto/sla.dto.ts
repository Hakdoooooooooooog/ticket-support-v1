import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const workingWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});

export const updateSlaPolicySchema = z.object({
  firstResponseMinutes: z.number().int().min(1).optional(),
  resolutionMinutes: z.number().int().min(1).optional(),
  warnAtPercent: z.number().int().min(1).max(99).optional(),
  is24x7: z.boolean().optional(),
  enabled: z.boolean().optional(),
  calendarId: z.string().nullable().optional(),
});

export class UpdateSlaPolicyDto extends createZodDto(updateSlaPolicySchema) {}

export const createBusinessCalendarSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().default('Asia/Manila'),
  isDefault: z.boolean().default(false),
  workingWindows: z.array(workingWindowSchema).default([]),
});

export class CreateBusinessCalendarDto extends createZodDto(createBusinessCalendarSchema) {}

export const updateBusinessCalendarSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  isDefault: z.boolean().optional(),
  workingWindows: z.array(workingWindowSchema).optional(),
});

export class UpdateBusinessCalendarDto extends createZodDto(updateBusinessCalendarSchema) {}

export const addHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  name: z.string().min(1).max(100),
  isMovable: z.boolean().default(false),
});

export class AddHolidayDto extends createZodDto(addHolidaySchema) {}
