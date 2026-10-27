import {
  createTicketSchema,
  updateTicketSchema,
  ticketResponseSchema,
  CreateTicketInput,
  UpdateTicketInput,
  TicketResponseDto,
} from '../schemas/ticket.schema.js';

export class TicketMapper {
  /**
   * Maps incoming raw DTO payload to validated Prisma Create input.
   * Runs createTicketSchema.parse() to apply all validation and defaults.
   */
  static toCreateInput(dto: unknown, creatorId: string) {
    const validated = createTicketSchema.parse(dto);
    return {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      creatorId,
    };
  }

  /**
   * Maps incoming partial DTO payload to validated Prisma Update input.
   */
  static toUpdateInput(dto: unknown) {
    const validated = updateTicketSchema.parse(dto);
    return {
      ...(validated.title ? { title: validated.title } : {}),
      ...(validated.description ? { description: validated.description } : {}),
      ...(validated.priority ? { priority: validated.priority } : {}),
      ...(validated.status ? { status: validated.status } : {}),
    };
  }

  /**
   * Maps raw Prisma database record to client Response DTO.
   * Runs ticketResponseSchema.parse() which transforms Dates to ISO strings,
   * strips unwanted fields, and populates missing fields with safe defaults.
   */
  static toResponseDto(rawEntity: unknown): TicketResponseDto {
    return ticketResponseSchema.parse(rawEntity);
  }

  /**
   * Maps an array of raw Prisma database records to client Response DTOs.
   */
  static toResponseDtoList(rawEntities: unknown[]): TicketResponseDto[] {
    return rawEntities.map((entity) => this.toResponseDto(entity));
  }
}
