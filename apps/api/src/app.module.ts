import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module.js';
import { StorageModule } from './storage/storage.module.js';
import { IncidentBannersModule } from './incident-banners/incident-banners.module.js';
import { AuditModule } from './audit/audit.module.js';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: 60000, limit: 100 },
          { name: 'auth_login', ttl: 60000, limit: 20 },
          { name: 'auth_register', ttl: 60000, limit: 15 },
          { name: 'auth_invite', ttl: 60000, limit: 30 },
          { name: 'auth_refresh', ttl: 60000, limit: 60 },
        ],
        storage: new RedisThrottlerStorage(
          config.get<string>('REDIS_URL') || process.env.REDIS_URL,
        ),
      }),
    }),
    PrismaModule,
    AuditModule,
    RealtimeModule,
    NotificationsModule,
    TicketsModule,
    AuthModule,
    CannedResponsesModule,
    ReportsModule,
    KnowledgeBaseModule,
    StorageModule,
    IncidentBannersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
