import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { IncidentBannersService } from './incident-banners.service.js';
import { CreateIncidentBannerDto, UpdateIncidentBannerDto } from './dto/create-incident-banner.dto.js';

@ApiTags('Incident Banners')
@Controller('incident-banners')
export class IncidentBannersController {
  constructor(private readonly bannersService: IncidentBannersService) {}

  @Get('active')
  @ApiOperation({ summary: 'List all currently active global incident and maintenance banners' })
  async findActive() {
    return this.bannersService.findActive();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all incident banners (active and historical) for staff review' })
  async findAll() {
    return this.bannersService.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Get a specific incident banner by ID' })
  async findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publish a new global incident outage banner (Admin only)' })
  async create(@Body() dto: CreateIncidentBannerDto, @Req() req: any) {
    return this.bannersService.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update or toggle an incident outage banner (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateIncidentBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete an incident outage banner (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.bannersService.delete(id);
  }
}
