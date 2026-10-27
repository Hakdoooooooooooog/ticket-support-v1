import { createZodDto } from 'nestjs-zod';
import { updateTicketSchema } from '../schemas/ticket.schema.js';

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export class UpdateTicketDto extends createZodDto(updateTicketSchema) {}
