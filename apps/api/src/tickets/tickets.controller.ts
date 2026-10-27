import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TicketsService } from './tickets.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ZodSerializerInterceptor } from '../common/interceptors/zod-serializer.interceptor.js';
import { Serialize } from '../common/decorators/zod-serializer.decorator.js';
import {
  CreateTicketDto,
  UpdateTicketDto,
  CreateCommentDto,
  createTicketSchema,
  updateTicketSchema,
  createCommentSchema,
  ticketResponseSchema,
} from './dto/index.js';

@ApiTags('Tickets')
@Controller('tickets')
@UseInterceptors(ZodSerializerInterceptor)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'List all tickets with optional status filter' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by ticket status' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  findAll(@Query('status') status?: string) {
    return this.ticketsService.findAll(status);
  }

  @Get(':id')
  @Serialize(ticketResponseSchema)
  @ApiOperation({ summary: 'Get a single ticket by id' })
  @ApiResponse({ status: 200, description: 'Ticket found' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Get(':id/attachment')
  @ApiOperation({
    summary: 'Retrieve ticket image attachment',
  })
  @ApiResponse({ status: 200, description: 'Attachment retrieved' })
  @ApiResponse({ status: 404, description: 'Ticket or attachment not found' })
  getAttachment(@Param('id') id: string) {
    return this.ticketsService.getAttachment(id);
  }

  @Post()
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createTicketSchema))
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket successfully created' })
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Patch(':id')
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(updateTicketSchema))
  @ApiOperation({ summary: 'Update an existing ticket' })
  @ApiResponse({ status: 200, description: 'Ticket updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Post(':id/comments')
  @Serialize(ticketResponseSchema)
  @UsePipes(new ZodValidationPipe(createCommentSchema))
  @ApiOperation({ summary: 'Add a comment or resolution note to a ticket' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  addComment(@Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.ticketsService.addComment(id, dto.content, dto.authorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket' })
  @ApiResponse({ status: 204, description: 'Ticket deleted successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  remove(@Param('id') id: string) {
    return this.ticketsService.remove(id);
  }
}
