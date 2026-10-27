import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  NotificationResponseDto,
  NotificationListResponseDto,
  notificationResponseSchema,
  notificationListResponseSchema,
} from './dto/notification-response.dto.js';

export interface CreateNotificationParams {
  userId: string;
  ticketId: string;
  type:
    | 'TICKET_FOLLOW_UP_REQUESTED'
    | 'TICKET_CUSTOMER_AMENDED'
    | 'TICKET_NOTE_POSTED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_STATUS_CHANGED';
  title: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, limit = 50): Promise<NotificationListResponseDto> {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    const mapped = notifications.map((n) =>
      notificationResponseSchema.parse({
        ...n,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      }),
    );

    return notificationListResponseSchema.parse({
      notifications: mapped,
      unreadCount,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Notification not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return notificationResponseSchema.parse({
      ...updated,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { success: true, count: res.count };
  }

  async createNotification(params: CreateNotificationParams): Promise<NotificationResponseDto | null> {
    try {
      const created = await this.prisma.notification.create({
        data: {
          userId: params.userId,
          ticketId: params.ticketId,
          type: params.type,
          title: params.title,
          message: params.message,
        },
      });

      return notificationResponseSchema.parse({
        ...created,
        readAt: created.readAt ? created.readAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (err) {
      // Soft-fail notification creation if user or ticket no longer exists
      console.error('Failed to create notification:', err);
      return null;
    }
  }
}
