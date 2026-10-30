import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SlaService } from './sla.service.js';
import {
  UpdateSlaPolicyDto,
  updateSlaPolicySchema,
  CreateBusinessCalendarDto,
  createBusinessCalendarSchema,
  UpdateBusinessCalendarDto,
  updateBusinessCalendarSchema,
  AddHolidayDto,
  addHolidaySchema,
} from './dto/sla.dto.js';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  };
}

@ApiTags('SLA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sla')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get('policies')
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all SLA policies' })
  @ApiResponse({ status: 200, description: 'List of SLA policies' })
  getAllPolicies() {
    return this.slaService.getAllPolicies();
  }

  @Put('policies/:id')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(updateSlaPolicySchema))
  @ApiOperation({ summary: 'Update an SLA policy (Admin only)' })
  @ApiResponse({ status: 200, description: 'Updated SLA policy' })
  updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateSlaPolicyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.slaService.updatePolicy(id, dto, req?.user);
  }

  @Get('calendars')
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'List all business calendars' })
  @ApiResponse({ status: 200, description: 'List of business calendars' })
  getAllCalendars() {
    return this.slaService.getAllCalendars();
  }

  @Post('calendars')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(createBusinessCalendarSchema))
  @ApiOperation({ summary: 'Create a new business calendar (Admin only)' })
  @ApiResponse({ status: 201, description: 'Created business calendar' })
  createCalendar(@Body() dto: CreateBusinessCalendarDto) {
    return this.slaService.createCalendar(dto);
  }

  @Put('calendars/:id')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(updateBusinessCalendarSchema))
  @ApiOperation({ summary: 'Update a business calendar (Admin only)' })
  @ApiResponse({ status: 200, description: 'Updated business calendar' })
  updateCalendar(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessCalendarDto,
  ) {
    return this.slaService.updateCalendar(id, dto);
  }

  @Post('calendars/:id/holidays')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(addHolidaySchema))
  @ApiOperation({ summary: 'Add a holiday to a business calendar (Admin only)' })
  @ApiResponse({ status: 201, description: 'Added holiday' })
  addHoliday(
    @Param('id') id: string,
    @Body() dto: AddHolidayDto,
  ) {
    return this.slaService.addHoliday(id, dto);
  }

  @Delete('calendars/:id/holidays/:holidayId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a holiday from a business calendar (Admin only)' })
  @ApiResponse({ status: 200, description: 'Removed holiday' })
  removeHoliday(
    @Param('id') calendarId: string,
    @Param('holidayId') holidayId: string,
  ) {
    return this.slaService.removeHoliday(calendarId, holidayId);
  }
}
