import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { KnowledgeBaseService } from './knowledge-base.service.js';
import { CreateArticleDto, UpdateArticleDto } from './knowledge-base.types.js';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list self-service knowledge base troubleshooting articles' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    return this.kbService.findAll(search, department, req?.user, status);
  }

  @Get('stats')
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Get global knowledge base deflection & resolution metrics' })
  async getStats() {
    return this.kbService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific knowledge base article by ID or slug' })
  async findOne(@Param('id') id: string, @Req() req?: any) {
    return this.kbService.findByIdOrSlug(id, req?.user);
  }

  @Post()
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Draft a new knowledge base troubleshooting article (Staff only)' })
  async create(@Body() dto: CreateArticleDto, @Req() req: any) {
    return this.kbService.create(dto, this.extractUserId(req)!);
  }

  @Patch(':id')
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Update an existing knowledge base troubleshooting article (Author or Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: any,
  ) {
    return this.kbService.update(id, dto, req.user);
  }

  @Post(':id/publish')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Publish a knowledge base guide to customer self-service (Admin only)' })
  async publish(@Param('id') id: string, @Req() req: any) {
    return this.kbService.publish(id, this.extractUserId(req)!);
  }

  @Post(':id/archive')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Archive a knowledge base guide (Admin only)' })
  async archive(@Param('id') id: string) {
    return this.kbService.archive(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a knowledge base guide permanently (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.kbService.delete(id);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Record helpful/unhelpful rating on a knowledge base guide' })
  async recordFeedback(
    @Param('id') id: string,
    @Body('helpful') helpful: boolean,
    @Req() req: any,
  ) {
    return this.kbService.recordFeedback(id, Boolean(helpful), this.extractUserId(req)!);
  }

  @Post(':id/deflection')
  @ApiOperation({ summary: 'Record ticket deflection event when customer solves issue via self-help' })
  async recordDeflection(@Param('id') id: string, @Req() req?: any) {
    return this.kbService.recordDeflection(id, this.extractUserId(req));
  }

  /**
   * Safely extracts actor user ID from the incoming request.
   */
  private extractUserId(req?: any): string | undefined {
    return req?.user?.id;
  }
}
