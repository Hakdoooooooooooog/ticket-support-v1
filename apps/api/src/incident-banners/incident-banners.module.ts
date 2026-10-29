import { Module } from '@nestjs/common';
import { IncidentBannersService } from './incident-banners.service.js';
import { IncidentBannersController } from './incident-banners.controller.js';

@Module({
  controllers: [IncidentBannersController],
  providers: [IncidentBannersService],
  exports: [IncidentBannersService],
})
export class IncidentBannersModule {}
