import { createZodDto } from 'nestjs-zod';
import { createTicketSchema } from '../schemas/ticket.schema.js';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateTicketDto extends createZodDto(createTicketSchema) {}
