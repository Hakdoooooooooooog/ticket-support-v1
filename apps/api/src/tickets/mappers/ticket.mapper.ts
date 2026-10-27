import {
  createTicketSchema,
  updateTicketSchema,
  ticketResponseSchema,
  TicketResponseDto,
} from '../dto/index.js';
import { decryptAndCompressAttachment } from '../attachment-crypto.util.js';

export class TicketMapper {
  /**
   * Maps incoming raw DTO payload to validated Prisma Create input.
   * Runs createTicketSchema.parse() to apply all validation and defaults.
   */
  static toCreateInput(dto: unknown, creatorId: string) {
    const validated = createTicketSchema.parse(dto);
    const compressedAttachment = validated.encryptedAttachment
      ? decryptAndCompressAttachment(validated.encryptedAttachment)
      : undefined;

    return {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      creatorId,
      ...(compressedAttachment ? compressedAttachment : {}),
    };
  }

  /**
   * Maps incoming partial DTO payload to validated Prisma Update input.
   */
  static toUpdateInput(dto: unknown) {
    const validated = updateTicketSchema.parse(dto);
    let attachmentPatch: Record<string, unknown> = {};

    if (validated.encryptedAttachment) {
      attachmentPatch = {
        ...decryptAndCompressAttachment(validated.encryptedAttachment),
      };
    } else if (validated.encryptedAttachment === null) {
      attachmentPatch = {
        attachmentName: null,
        attachmentMimeType: null,
        attachmentCompressed: null,
        attachmentOriginalSize: null,
        attachmentCompressedSize: null,
      };
    }

    return {
      ...(validated.title ? { title: validated.title } : {}),
      ...(validated.description ? { description: validated.description } : {}),
      ...(validated.priority ? { priority: validated.priority } : {}),
      ...(validated.status ? { status: validated.status } : {}),
      ...(validated.assigneeId !== undefined ? { assigneeId: validated.assigneeId } : {}),
      ...attachmentPatch,
    };
  }

  /**
   * Maps raw Prisma database record to client Response DTO.
   * Runs ticketResponseSchema.parse() which transforms Dates to ISO strings,
   * strips unwanted fields, and populates missing fields with safe defaults.
   */
  static toResponseDto(rawEntity: unknown): TicketResponseDto {
    const record = (rawEntity && typeof rawEntity === 'object' ? rawEntity : {}) as Record<
      string,
      unknown
    >;
    const hasAttachment = Boolean(
      record.hasAttachment || record.attachmentName || record.attachmentCompressed,
    );
    return ticketResponseSchema.parse({
      ...record,
      hasAttachment,
    });
  }

  /**
   * Maps an array of raw Prisma database records to client Response DTOs.
   */
  static toResponseDtoList(rawEntities: unknown[]): TicketResponseDto[] {
    return rawEntities.map((entity) => this.toResponseDto(entity));
  }
}
