import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodSerializerInterceptor } from '../common/interceptors/zod-serializer.interceptor.js';
import { Serialize } from '../common/decorators/zod-serializer.decorator.js';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  notificationListResponseSchema,
  notificationResponseSchema,
} from './dto/notification-response.dto.js';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    role: string;
  } | null;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(OptionalJwtAuthGuard)
@UseInterceptors(ZodSerializerInterceptor)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Serialize(notificationListResponseSchema)
  @ApiOperation({ summary: 'Get current user notifications and unread count' })
  @ApiResponse({ status: 200, description: 'User notifications retrieved' })
  async getMyNotifications(
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationListResponseDto> {
    if (!req.user?.id) {
      return {
        notifications: [],
        unreadCount: 0,
      };
    }
    return this.notificationsService.getForUser(req.user.id);
  }

  @Patch(':id/read')
  @Serialize(notificationResponseSchema)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markRead(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationResponseDto> {
    if (!req.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications for current user as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllRead(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; count: number }> {
    if (!req.user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
