import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './database/prisma.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { AuthModule } from './auth/auth.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { CannedResponsesModule } from './canned-responses/canned-responses.module.js';
import { ReportsModule } from './reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    PrismaModule,
    RealtimeModule,
    NotificationsModule,
    TicketsModule,
    AuthModule,
    CannedResponsesModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
