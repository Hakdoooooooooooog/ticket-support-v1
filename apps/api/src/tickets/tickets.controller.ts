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
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
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
  user?: TicketActorContext | null;
}

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(OptionalJwtAuthGuard)
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
    const req = typeof departmentOrReq === 'object' && departmentOrReq !== null ? departmentOrReq : maybeReq;
    const department = typeof departmentOrReq === 'string' ? departmentOrReq : undefined;
    const actor = req?.user ?? undefined;
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

  @Get(':id')
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'Get a single ticket by id' })
  @ApiResponse({ status: 200, description: 'Ticket found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string, @Req() req?: AuthenticatedRequest) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.findOne(id, actor)
      : this.ticketsService.findOne(id);
  }

  @Get(':id/attachment')
  @ApiOperation({
    summary: 'Retrieve ticket image attachment',
  })
  @ApiResponse({ status: 200, description: 'Attachment retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket or attachment not found' })
  getAttachment(@Param('id') id: string, @Req() req?: AuthenticatedRequest) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.getAttachment(id, actor)
      : this.ticketsService.getAttachment(id);
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
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.getCommentAttachment(id, commentId, actor)
      : this.ticketsService.getCommentAttachment(id, commentId);
  }

  @Post()
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createTicketSchema))
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket successfully created' })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.create(createTicketDto, actor.id, actor)
      : this.ticketsService.create(createTicketDto);
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
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.update(id, updateTicketDto, actor)
      : this.ticketsService.update(id, updateTicketDto);
  }

  @Post(':id/auto-assign')
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'Automatically assign ticket via round-robin distribution' })
  @ApiResponse({ status: 200, description: 'Ticket automatically assigned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  autoAssign(
    @Param('id') id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return this.ticketsService.autoAssignTicket(id, actor);
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
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.addComment(
          id,
          dto.content,
          dto.authorId,
          dto.encryptedAttachment,
          actor,
        )
      : this.ticketsService.addComment(
          id,
          dto.content,
          dto.authorId,
          dto.encryptedAttachment,
        );
  }

  @Post(':id/csat')
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
    @Req() req?: AuthenticatedRequest,
  ) {
    const actor = req?.user ?? undefined;
    return this.ticketsService.submitCsat(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket' })
  @ApiResponse({ status: 204, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(@Param('id') id: string, @Req() req?: AuthenticatedRequest) {
    const actor = req?.user ?? undefined;
    return actor
      ? this.ticketsService.remove(id, actor)
      : this.ticketsService.remove(id);
  }
}
