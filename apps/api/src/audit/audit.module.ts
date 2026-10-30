import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
