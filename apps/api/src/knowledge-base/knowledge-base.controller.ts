import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { KnowledgeBaseService } from './knowledge-base.service.js';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list self-service knowledge base troubleshooting articles' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  async findAll(
    @Query('search') search?: string,
    @Query('department') department?: string,
  ) {
    return this.kbService.findAll(search, department);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get global knowledge base deflection & resolution metrics' })
  async getStats() {
    return this.kbService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific knowledge base article by ID or slug' })
  async findOne(@Param('id') id: string) {
    return this.kbService.findByIdOrSlug(id);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Record helpful/unhelpful rating on a knowledge base guide' })
  async recordFeedback(
    @Param('id') id: string,
    @Body('helpful') helpful: boolean,
  ) {
    return this.kbService.recordFeedback(id, Boolean(helpful));
  }

  @Post(':id/deflection')
  @ApiOperation({ summary: 'Record ticket deflection event when customer solves issue via self-help' })
  async recordDeflection(@Param('id') id: string) {
    return this.kbService.recordDeflection(id);
  }
}
