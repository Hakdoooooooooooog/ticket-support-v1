import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService, TicketActorContext } from './tickets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ZodSerializerInterceptor } from '../common/interceptors/zod-serializer.interceptor.js';
import { Serialize } from '../common/decorators/zod-serializer.decorator.js';
import {
  CreateTicketDto,
  UpdateTicketDto,
  CreateCommentDto,
  CreateCsatDto,
  createTicketSchema,
  updateTicketSchema,
  createCommentSchema,
  createCsatSchema,
  ticketResponseSchema,
} from './dto/index.js';

interface AuthenticatedRequest {
  user: TicketActorContext;
}

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ZodSerializerInterceptor)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'List tickets with role-scoped visibility and optional filters' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by ticket status' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by ticket priority' })
  @ApiQuery({ name: 'department', required: false, description: 'Filter by ticket department' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by ID, title, description, or customer' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('department') departmentOrReq?: string | AuthenticatedRequest,
    @Req() maybeReq?: AuthenticatedRequest,
  ) {
    const { department, actor } = this.extractQueryContext(departmentOrReq, maybeReq);
    if (!priority && !department && !search && !actor) {
      return this.ticketsService.findAll(status);
    }
    return this.ticketsService.findAll(status, {
      priority,
      department,
      search,
      actor,
    });
  }

  /**
   * Resolves query and request arguments to extract department and actor context.
   */
  private extractQueryContext(
    departmentOrReq?: string | AuthenticatedRequest,
    maybeReq?: AuthenticatedRequest,
  ): { department?: string; actor?: TicketActorContext } {
    const req =
      typeof departmentOrReq === 'object' && departmentOrReq !== null
        ? departmentOrReq
        : maybeReq;
    const department =
      typeof departmentOrReq === 'string' ? departmentOrReq : undefined;
    const actor = req?.user ?? undefined;
    return { department, actor };
  }

  @Get(':id')
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'Get a single ticket by id' })
  @ApiResponse({ status: 200, description: 'Ticket found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.findOne(id, req?.user);
  }

  @Get(':id/attachment')
  @ApiOperation({
    summary: 'Retrieve ticket image attachment',
  })
  @ApiResponse({ status: 200, description: 'Attachment retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket or attachment not found' })
  getAttachment(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.getAttachment(id, req?.user);
  }

  @Get(':id/comments/:commentId/attachment')
  @ApiOperation({
    summary: 'Retrieve comment or follow-up message image attachment',
  })
  @ApiResponse({ status: 200, description: 'Comment attachment retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Comment or attachment not found' })
  getCommentAttachment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.getCommentAttachment(id, commentId, req?.user);
  }

  @Post()
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createTicketSchema))
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket successfully created' })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = req?.user;
    return this.ticketsService.create(createTicketDto, actor?.id, actor);
  }

  @Patch(':id')
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(updateTicketSchema))
  @ApiOperation({ summary: 'Update an existing ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(
    @Param('id') id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.update(id, updateTicketDto, req?.user);
  }

  @Post(':id/auto-assign')
  @Roles('ADMIN', 'AGENT')
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'Automatically assign ticket via round-robin distribution' })
  @ApiResponse({ status: 200, description: 'Ticket automatically assigned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  autoAssign(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.autoAssignTicket(id, req?.user);
  }

  @Post(':id/comments')
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createCommentSchema))
  @ApiOperation({ summary: 'Add a comment or resolution note to a ticket' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = req?.user;
    return this.ticketsService.addComment(
      id,
      dto.content,
      dto.authorId,
      dto.encryptedAttachment,
      actor,
    );
  }

  @Post(':id/csat')
  @Roles('CUSTOMER')
  @HttpCode(HttpStatus.OK)
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createCsatSchema))
  @ApiOperation({ summary: 'Submit customer satisfaction feedback on a resolved ticket' })
  @ApiResponse({ status: 200, description: 'CSAT rating submitted successfully' })
  @ApiResponse({ status: 400, description: 'Ticket is not resolved or invalid rating' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  submitCsat(
    @Param('id') id: string,
    @Body() dto: CreateCsatDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.submitCsat(id, dto, req?.user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket (Admin only)' })
  @ApiResponse({ status: 204, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.remove(id, req?.user);
  }
}
