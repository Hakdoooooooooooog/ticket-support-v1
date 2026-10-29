import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CannedResponsesService } from './canned-responses.service.js';
import {
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
} from './dto/canned-response.dto.js';

@ApiTags('Canned Responses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('canned-responses')
export class CannedResponsesController {
  constructor(private readonly cannedResponsesService: CannedResponsesService) {}

  @Get()
  @ApiOperation({ summary: 'List all organization canned responses and quick reply templates' })
  async findAll() {
    return this.cannedResponsesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new canned response template (Admin only)' })
  async create(@Body() dto: CreateCannedResponseDto, @Request() req: any) {
    this.assertAdminRole(req.user?.role, 'create');
    return this.cannedResponsesService.create(dto, req.user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing canned response template (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCannedResponseDto,
    @Request() req: any,
  ) {
    this.assertAdminRole(req.user?.role, 'modify');
    return this.cannedResponsesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a canned response template (Admin only)' })
  async delete(@Param('id') id: string, @Request() req: any) {
    this.assertAdminRole(req.user?.role, 'delete');
    return this.cannedResponsesService.delete(id);
  }

  /**
   * Enforces role requirement for administrative canned response operations.
   */
  private assertAdminRole(role?: string, action = 'manage'): void {
    if (role !== 'ADMIN') {
      throw new ForbiddenException(`Only IT Administrators can ${action} organization canned responses.`);
    }
  }
}
