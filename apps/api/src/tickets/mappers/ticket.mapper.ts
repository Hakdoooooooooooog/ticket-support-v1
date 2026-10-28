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
      department: validated.department,
      creatorId,
      ...(compressedAttachment ? compressedAttachment : {}),
    };
  }

  /**
   * Maps incoming partial DTO payload to validated Prisma Update input.
   * Note: When an encryptedAttachment is supplied on an amendment or follow-up,
   * it is attached to the corresponding activity Comment entry in TicketsService
   * so the message history preserves each attachment in context.
   */
  static toUpdateInput(dto: unknown) {
    const validated = updateTicketSchema.parse(dto);
    let attachmentPatch: Record<string, unknown> = {};

    if (validated.encryptedAttachment === null) {
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
      ...(validated.department ? { department: validated.department } : {}),
      ...(validated.assigneeId !== undefined ? { assigneeId: validated.assigneeId } : {}),
      ...attachmentPatch,
    };
  }

  /**
   * Decrypts and compresses an optional attachment for a comment/amendment message.
   */
  static toCommentAttachmentInput(dtoAttachment: unknown) {
    if (!dtoAttachment || typeof dtoAttachment !== 'object') {
      return {};
    }
    return {
      ...decryptAndCompressAttachment(dtoAttachment as any),
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

    const rawComments = Array.isArray(record.comments) ? record.comments : [];
    const mappedComments = rawComments.map((c: unknown) => {
      const commentObj = (c && typeof c === 'object' ? c : {}) as Record<
        string,
        unknown
      >;
      const commentHasAttachment = Boolean(
        commentObj.hasAttachment ||
          commentObj.attachmentName ||
          commentObj.attachmentCompressed,
      );
      return {
        ...commentObj,
        hasAttachment: commentHasAttachment,
      };
    });

    const hasTicketAttachment = Boolean(
      record.hasAttachment || record.attachmentName || record.attachmentCompressed,
    );

    return ticketResponseSchema.parse({
      ...record,
      hasAttachment: hasTicketAttachment,
      comments: mappedComments,
    });
  }

  /**
   * Maps an array of raw Prisma database records to client Response DTOs.
   */
  static toResponseDtoList(rawEntities: unknown[]): TicketResponseDto[] {
    return rawEntities.map((entity) => this.toResponseDto(entity));
  }
}
