import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
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
    | 'TICKET_CREATED'
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async getForUser(userId: string, limit = 50): Promise<NotificationListResponseDto> {
    const user =
      typeof this.prisma?.user?.findUnique === 'function'
        ? await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          })
        : null;

    // Administrators strictly receive TICKET_CREATED notifications. All other operational noise is omitted.
    const whereClause: any = { userId };
    if (user?.role === 'ADMIN') {
      whereClause.type = 'TICKET_CREATED';
    }

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({
        where: { ...whereClause, read: false },
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

  async notifyAdmins(params: {
    ticketId: string;
    title: string;
    message: string;
  }): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });

      await Promise.all(
        admins.map((admin) =>
          this.prisma.notification.create({
            data: {
              userId: admin.id,
              ticketId: params.ticketId,
              type: 'TICKET_CREATED',
              title: params.title,
              message: params.message,
            },
          }),
        ),
      );

      if (this.realtimeService) {
        this.realtimeService.emit({
          type: 'NOTIFICATION',
          recipientRoles: ['ADMIN'],
          payload: {
            ticketId: params.ticketId,
            type: 'TICKET_CREATED',
            title: params.title,
            message: params.message,
          },
        });
      }
    } catch (err) {
      console.error('Failed to notify administrators of new ticket:', err);
    }
  }

  async createNotification(params: CreateNotificationParams): Promise<NotificationResponseDto | null> {
    try {
      // If the notification is NOT a new ticket creation, verify that the recipient is not an administrator.
      // Administrators should strictly receive new ticket notifications, not agent-level operational noise.
      if (params.type !== 'TICKET_CREATED') {
        const recipient =
          typeof this.prisma?.user?.findUnique === 'function'
            ? await this.prisma.user.findUnique({
                where: { id: params.userId },
                select: { role: true },
              })
            : null;

        if (recipient?.role === 'ADMIN') {
          return null; // Suppress agent-level notifications for IT Administrators
        }
      }

      const created = await this.prisma.notification.create({
        data: {
          userId: params.userId,
          ticketId: params.ticketId,
          type: params.type,
          title: params.title,
          message: params.message,
        },
      });

      const result = notificationResponseSchema.parse({
        ...created,
        readAt: created.readAt ? created.readAt.toISOString() : null,
        createdAt: created.createdAt.toISOString(),
      });

      if (this.realtimeService) {
        this.realtimeService.emit({
          type: 'NOTIFICATION',
          recipientUserIds: [params.userId],
          payload: result,
        });
      }

      return result;
    } catch (err) {
      // Soft-fail notification creation if user or ticket no longer exists
      console.error('Failed to create notification:', err);
      return null;
    }
  }
}
