import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ role: 'AGENT' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
    };
    service = new NotificationsService(mockPrisma as unknown as PrismaService);
  });

  it('retrieves notifications and unread count for user', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        ticketId: 'ticket-1',
        type: 'TICKET_NOTE_POSTED',
        title: 'New note',
        message: 'Support posted an update',
        read: false,
        readAt: null,
        createdAt: new Date('2026-10-27T10:00:00Z'),
      },
    ];
    mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
    mockPrisma.notification.count.mockResolvedValue(1);

    const result = await service.getForUser('user-1');
    expect(result.notifications).toHaveLength(1);
    expect(result.unreadCount).toBe(1);
    expect(result.notifications[0].title).toBe('New note');
  });

  it('marks a specific notification as read', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
    });
    mockPrisma.notification.update.mockResolvedValue({
      id: 'notif-1',
      userId: 'user-1',
      ticketId: 'ticket-1',
      type: 'TICKET_NOTE_POSTED',
      title: 'New note',
      message: 'Support posted',
      read: true,
      readAt: new Date('2026-10-27T10:05:00Z'),
      createdAt: new Date('2026-10-27T10:00:00Z'),
    });

    const result = await service.markAsRead('notif-1', 'user-1');
    expect(result.read).toBe(true);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ read: true }),
      }),
    );
  });

  it('marks all notifications as read for a user', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead('user-1');
    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', read: false },
      }),
    );
  });

  it('creates a new notification', async () => {
    mockPrisma.notification.create.mockResolvedValue({
      id: 'notif-new',
      userId: 'user-1',
      ticketId: 'ticket-1',
      type: 'TICKET_ASSIGNED',
      title: 'Ticket Assigned',
      message: 'You have been assigned to ticket',
      read: false,
      readAt: null,
      createdAt: new Date('2026-10-27T10:10:00Z'),
    });

    const result = await service.createNotification({
      userId: 'user-1',
      ticketId: 'ticket-1',
      type: 'TICKET_ASSIGNED',
      title: 'Ticket Assigned',
      message: 'You have been assigned to ticket',
    });

    expect(result?.id).toBe('notif-new');
    expect(result?.type).toBe('TICKET_ASSIGNED');
  });

  it('filters out operational notifications for administrators in getForUser', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await service.getForUser('admin-1');

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'admin-1',
          type: { in: ['TICKET_CREATED', 'SLA_WARNING', 'SLA_BREACHED'] },
        },
      }),
    );
  });

  it('suppresses agent-level operational notifications when recipient is an ADMIN', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const result = await service.createNotification({
      userId: 'admin-1',
      ticketId: 'ticket-1',
      type: 'TICKET_STATUS_CHANGED',
      title: 'Customer Rated Ticket (5/5)',
      message: 'Great service',
    });

    expect(result).toBeNull();
    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('notifies all administrators when a new ticket is submitted via notifyAdmins', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'admin-1' },
      { id: 'admin-2' },
    ]);
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

    await service.notifyAdmins({
      ticketId: 'ticket-123',
      title: 'New Ticket: Server Outage',
      message: 'A new ticket #123 was submitted',
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
  });
});
