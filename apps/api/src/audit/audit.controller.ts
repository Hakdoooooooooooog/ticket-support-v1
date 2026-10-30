import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
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
import { Serialize } from '../common/decorators/zod-serializer.decorator.js';
import { AuditService } from './audit.service.js';
import {
  AuditLogFilterDto,
  auditLogFilterSchema,
  auditLogPaginatedResponseSchema,
  UpdateAuditSettingsDto,
  updateAuditSettingsSchema,
} from './dto/audit-log.dto.js';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
  };
}

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles('ADMIN')
  @Serialize(auditLogPaginatedResponseSchema)
  @ApiOperation({ summary: 'List and filter audit trail logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated audit records' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findAll(
    @Query(new ZodValidationPipe(auditLogFilterSchema)) query: AuditLogFilterDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auditService.findAll(query, req?.user);
  }

  @Get('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get audit retention policy configuration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Current retention configuration' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getSettings(@Req() req: AuthenticatedRequest) {
    return this.auditService.getSettings(req?.user);
  }

  @Patch('settings')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(updateAuditSettingsSchema))
  @ApiOperation({ summary: 'Update audit retention policy configuration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Updated retention configuration' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  updateSettings(
    @Body() dto: UpdateAuditSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auditService.updateSettings(dto, req.user as any);
  }
}
