import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';

@Module({
  imports: [AuthModule, NotificationsModule, StorageModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
