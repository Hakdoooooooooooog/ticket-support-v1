import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ReportsService } from './reports.service.js';
import { TicketActorContext } from '../tickets/tickets.service.js';

interface AuthenticatedRequest {
  user: TicketActorContext;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get operational metrics, department volumes, and CSAT breakdown' })
  @ApiResponse({ status: 200, description: 'Summary report generated' })
  @ApiResponse({ status: 403, description: 'Forbidden: Customers cannot access staff reports' })
  async getSummary(@Req() req?: AuthenticatedRequest) {
    const actor = req?.user ?? undefined;
    return this.reportsService.getSummary(actor);
  }

  @Get('tickets/csv')
  @ApiOperation({ summary: 'Export ticket dataset as RFC 4180 CSV' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by ticket status' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by ticket priority' })
  @ApiQuery({ name: 'department', required: false, description: 'Filter by ticket department' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter starting from creation date (ISO string)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter ending at creation date (ISO string)' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportTicketsCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('department') department?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    const csv = await this.reportsService.exportTicketsCsv(
      { status, priority, department, dateFrom, dateTo },
      actor,
    );

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tickets-export-${timestamp}.csv"`);
    res.status(200).send(csv);
  }

  @Get('csat/csv')
  @ApiOperation({ summary: 'Export CSAT customer survey feedback as RFC 4180 CSV' })
  @ApiResponse({ status: 200, description: 'CSAT CSV file download' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async exportCsatCsv(
    @Res() res: Response,
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    const csv = await this.reportsService.exportCsatCsv(actor);

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="csat-ratings-${timestamp}.csv"`);
    res.status(200).send(csv);
  }
}
