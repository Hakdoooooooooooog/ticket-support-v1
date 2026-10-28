import { Module, Global } from '@nestjs/common';
import { RealtimeService } from './realtime.service.js';
import { RealtimeController } from './realtime.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
