import { Module } from '@nestjs/common';
import { SlaService } from './sla.service.js';
import { SlaController } from './sla.controller.js';
import { PrismaModule } from '../database/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    AuditModule,
    RealtimeModule,
  ],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
