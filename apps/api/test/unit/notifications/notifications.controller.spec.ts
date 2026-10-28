import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from '../../../src/notifications/notifications.controller.js';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockService: {
    getForUser: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
    markAllAsRead: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      getForUser: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    };
    controller = new NotificationsController(mockService as unknown as NotificationsService);
  });

  describe('getMyNotifications', () => {
    it('returns empty notifications when request has no authenticated user', async () => {
      const result = await controller.getMyNotifications({ user: null });
      expect(result).toEqual({ notifications: [], unreadCount: 0 });
      expect(mockService.getForUser).not.toHaveBeenCalled();
    });

    it('delegates to notificationsService.getForUser for authenticated user', async () => {
      const mockResult = {
        notifications: [
          {
            id: 'notif-1',
            userId: 'user-1',
            ticketId: 'ticket-1',
            type: 'TICKET_CREATED',
            title: 'New incident',
            message: 'Pending triage',
            read: false,
            readAt: null,
            createdAt: '2026-10-27T10:00:00.000Z',
          },
        ],
        unreadCount: 1,
      };
      mockService.getForUser.mockResolvedValue(mockResult);

      const result = await controller.getMyNotifications({
        user: { id: 'user-1', email: 'test@example.com', role: 'CUSTOMER' },
      });

      expect(mockService.getForUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('markRead', () => {
    it('throws UnauthorizedException when user is unauthenticated', async () => {
      await expect(controller.markRead('notif-1', { user: null })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockService.markAsRead).not.toHaveBeenCalled();
    });

    it('calls notificationsService.markAsRead with notification id and user id', async () => {
      const mockUpdated = {
        id: 'notif-1',
        userId: 'user-1',
        ticketId: 'ticket-1',
        type: 'TICKET_CREATED',
        title: 'New incident',
        message: 'Pending triage',
        read: true,
        readAt: '2026-10-27T10:05:00.000Z',
        createdAt: '2026-10-27T10:00:00.000Z',
      };
      mockService.markAsRead.mockResolvedValue(mockUpdated);

      const result = await controller.markRead('notif-1', {
        user: { id: 'user-1', email: 'test@example.com', role: 'CUSTOMER' },
      });

      expect(mockService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('markAllRead', () => {
    it('throws UnauthorizedException when user is unauthenticated', async () => {
      await expect(controller.markAllRead({ user: null })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockService.markAllAsRead).not.toHaveBeenCalled();
    });

    it('calls notificationsService.markAllAsRead with user id', async () => {
      mockService.markAllAsRead.mockResolvedValue({ success: true, count: 5 });

      const result = await controller.markAllRead({
        user: { id: 'user-1', email: 'test@example.com', role: 'CUSTOMER' },
      });

      expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, count: 5 });
    });
  });
});
