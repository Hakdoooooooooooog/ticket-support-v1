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
    let attachmentFields: Record<string, unknown> = {};

    if (validated.encryptedAttachment) {
      if (validated.encryptedAttachment.storageType === 'S3') {
        attachmentFields = {
          attachmentName: validated.encryptedAttachment.fileName,
          attachmentMimeType: validated.encryptedAttachment.mimeType,
          attachmentStorageKey: validated.encryptedAttachment.storageKey,
          attachmentStorageType: 'S3',
          attachmentBucket: validated.encryptedAttachment.bucket,
          attachmentOriginalSize: validated.encryptedAttachment.originalSize,
          attachmentCompressedSize: validated.encryptedAttachment.compressedSize || validated.encryptedAttachment.originalSize,
        };
      } else if (validated.encryptedAttachment.ciphertext && validated.encryptedAttachment.iv) {
        attachmentFields = {
          ...decryptAndCompressAttachment(validated.encryptedAttachment as any),
          attachmentStorageType: 'BASE64',
        };
      }
    }

    return {
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      department: validated.department,
      creatorId,
      ...attachmentFields,
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
        attachmentStorageKey: null,
        attachmentStorageType: null,
        attachmentBucket: null,
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
   * Decrypts and compresses an optional attachment for a comment/amendment message,
   * or attaches S3 storage key metadata if uploaded directly to S3.
   */
  static toCommentAttachmentInput(dtoAttachment: unknown) {
    if (!dtoAttachment || typeof dtoAttachment !== 'object') {
      return {};
    }
    const att = dtoAttachment as Record<string, any>;
    if (att.storageType === 'S3') {
      return {
        attachmentName: att.fileName,
        attachmentMimeType: att.mimeType,
        attachmentStorageKey: att.storageKey,
        attachmentStorageType: 'S3',
        attachmentBucket: att.bucket,
        attachmentOriginalSize: att.originalSize,
        attachmentCompressedSize: att.compressedSize || att.originalSize,
      };
    }
    if (att.ciphertext && att.iv) {
      return {
        ...decryptAndCompressAttachment(att as any),
        attachmentStorageType: 'BASE64',
      };
    }
    return {};
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
          commentObj.attachmentCompressed ||
          commentObj.attachmentStorageKey,
      );
      return {
        ...commentObj,
        hasAttachment: commentHasAttachment,
      };
    });

    const hasTicketAttachment = Boolean(
      record.hasAttachment ||
        record.attachmentName ||
        record.attachmentCompressed ||
        record.attachmentStorageKey,
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
