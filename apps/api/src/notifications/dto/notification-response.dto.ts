import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { dateToIsoString } from '../../common/schemas/common.schema.js';

export const notificationTypeEnum = z.enum([
  'TICKET_FOLLOW_UP_REQUESTED',
  'TICKET_CUSTOMER_AMENDED',
  'TICKET_NOTE_POSTED',
  'TICKET_ASSIGNED',
  'TICKET_STATUS_CHANGED',
]);

export const notificationResponseSchema = z.object({
  id: z.string().default(''),
  userId: z.string().default(''),
  ticketId: z.string().default(''),
  type: notificationTypeEnum.default('TICKET_STATUS_CHANGED'),
  title: z.string().default('Notification'),
  message: z.string().default(''),
  read: z.boolean().default(false),
  readAt: dateToIsoString.nullable().optional().default(null),
  createdAt: dateToIsoString.default(() => new Date().toISOString()),
});

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationResponseSchema).default([]),
  unreadCount: z.number().int().min(0).default(0),
});

export class NotificationResponseDto extends createZodDto(notificationResponseSchema) {}
export class NotificationListResponseDto extends createZodDto(notificationListResponseSchema) {}
