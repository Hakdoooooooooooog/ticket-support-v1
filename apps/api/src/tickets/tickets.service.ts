import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateTicketDto, UpdateTicketDto, TicketResponseDto } from './dto/index.js';
import { TicketMapper } from './mappers/ticket.mapper.js';
import {
  decompressAndEncryptAttachment,
  OnDemandAttachmentResponse,
} from './attachment-crypto.util.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes a database unit of work inside an interactive Prisma transaction
   * so any validation failure, constraint error, or exception rolls back all writes.
   */
  protected async runTransaction<T>(
    fn: (tx: PrismaService) => Promise<T>,
  ): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(async (tx) => fn(tx as unknown as PrismaService));
    }
    return fn(this.prisma);
  }

  async findAll(status?: string): Promise<TicketResponseDto[]> {
    const records = await this.prisma.ticket.findMany({
      where: status ? { status: status as any } : undefined,
      include: this.standardTicketInclude,
      orderBy: { createdAt: 'desc' },
    });

    return TicketMapper.toResponseDtoList(records);
  }

  async findOne(id: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: this.standardTicketInclude,
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found`);
    }

    return TicketMapper.toResponseDto(ticket);
  }

  async create(dto: CreateTicketDto, creatorId?: string): Promise<TicketResponseDto> {
    return this.runTransaction(async (tx) => {
      const user = await this.resolveCreatorUser(creatorId || dto.creatorId, tx);
      const createData = TicketMapper.toCreateInput(dto, user.id);

      if (typeof tx.ticket.findFirst === 'function') {
        const duplicateActiveTicket = await tx.ticket.findFirst({
          where: {
            creatorId: user.id,
            title: { equals: createData.title, mode: 'insensitive' },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          select: { id: true },
        });

        if (duplicateActiveTicket) {
          throw new ConflictException(
            'An active ticket with this title already exists for this user',
          );
        }
      }

      const record = await tx.ticket.create({
        data: createData,
        include: this.standardTicketInclude,
      });

      return TicketMapper.toResponseDto(record);
    });
  }

  async addComment(
    ticketId: string,
    content: string,
    authorId?: string,
  ): Promise<TicketResponseDto> {
    const trimmedContent = content.trim();

    return this.runTransaction(async (tx) => {
      const existingTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: this.standardTicketInclude,
      });

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID "${ticketId}" not found`);
      }

      const author = await this.resolveCreatorUser(authorId, tx);

      if (typeof tx.comment?.findFirst === 'function') {
        const duplicateComment = await tx.comment.findFirst({
          where: {
            ticketId,
            authorId: author.id,
            content: { equals: trimmedContent, mode: 'insensitive' },
          },
          select: { id: true },
        });

        if (duplicateComment) {
          throw new ConflictException('Duplicate comment already posted on this ticket');
        }
      }

      await tx.comment.create({
        data: {
          ticketId,
          content: trimmedContent,
          authorId: author.id,
        },
      });

      const updatedTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: this.standardTicketInclude,
      });

      return TicketMapper.toResponseDto(updatedTicket!);
    });
  }

  async update(id: string, dto: UpdateTicketDto): Promise<TicketResponseDto> {
    return this.runTransaction(async (tx) => {
      const existingTicket = await tx.ticket.findUnique({
        where: { id },
        include: this.standardTicketInclude,
      });

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID "${id}" not found`);
      }

      if (dto.assigneeId !== undefined && dto.assigneeId !== null) {
        const assignee = await tx.user.findUnique({
          where: { id: dto.assigneeId },
          select: { id: true, role: true },
        });

        if (!assignee) {
          throw new BadRequestException(`Assignee with ID "${dto.assigneeId}" does not exist`);
        }

        if (assignee.role !== 'ADMIN' && assignee.role !== 'AGENT') {
          throw new ForbiddenException(
            'Tickets can only be assigned to ADMIN or AGENT personnel',
          );
        }
      }

      const updateData = TicketMapper.toUpdateInput(dto) as Record<string, unknown>;

      // If a customer amends a ticket that was waiting on NEEDS_INFO, automatically reopen it
      const isCustomerAmendment =
        !dto.status &&
        (dto.title !== undefined ||
          dto.description !== undefined ||
          dto.encryptedAttachment !== undefined ||
          dto.amendmentNote !== undefined);

      if (
        isCustomerAmendment &&
        (existingTicket as { status?: string }).status === 'NEEDS_INFO'
      ) {
        updateData.status = (existingTicket as { assigneeId?: string | null }).assigneeId
          ? 'IN_PROGRESS'
          : 'OPEN';
      }

      if (dto.amendmentNote && typeof tx.comment?.create === 'function') {
        const actor = await this.resolveCreatorUser(
          dto.actorId || (existingTicket as { creatorId?: string }).creatorId,
          tx,
        );
        await tx.comment.create({
          data: {
            ticketId: id,
            content: dto.amendmentNote.trim(),
            authorId: actor.id,
          },
        });
      }

      const updated = await tx.ticket.update({
        where: { id },
        data: updateData as any,
        include: this.standardTicketInclude,
      });

      return TicketMapper.toResponseDto(updated);
    });
  }

  async getAttachment(id: string): Promise<OnDemandAttachmentResponse> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        attachmentName: true,
        attachmentMimeType: true,
        attachmentCompressed: true,
        attachmentOriginalSize: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found`);
    }

    if (!ticket.attachmentCompressed) {
      throw new NotFoundException(`Ticket "${id}" does not have an image attachment`);
    }

    const { ciphertext, iv, decompressedSize } = decompressAndEncryptAttachment(
      ticket.attachmentCompressed,
    );

    return {
      ticketId: ticket.id,
      fileName: ticket.attachmentName || 'attachment.webp',
      mimeType: ticket.attachmentMimeType || 'image/webp',
      originalSize: ticket.attachmentOriginalSize || decompressedSize,
      encrypted: {
        ciphertext,
        iv,
      },
    };
  }

  async remove(id: string): Promise<void> {
    await this.runTransaction(async (tx) => {
      const existingTicket = await tx.ticket.findUnique({
        where: { id },
        include: this.standardTicketInclude,
      });

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID "${id}" not found`);
      }

      await tx.ticket.delete({
        where: { id },
      });
    });
  }

  /**
   * Resolves the author/creator User model within the active transaction.
   * If not found or omitted, creates or retrieves a safe fallback demo customer.
   */
  protected async resolveCreatorUser(
    creatorId?: string,
    tx: PrismaService = this.prisma,
  ) {
    if (creatorId) {
      const user = await tx.user.findUnique({ where: { id: creatorId } });
      if (user) return user;
    }

    return tx.user.upsert({
      where: { email: 'demo@ticketsupport.com' },
      update: {},
      create: {
        email: 'demo@ticketsupport.com',
        fullName: 'Demo Customer',
        passwordHash: 'demohash',
        role: 'CUSTOMER',
      },
    });
  }

  /**
   * Reusable Prisma relations include clause for consistent serialization.
   */
  protected get standardTicketInclude() {
    return {
      creator: {
        select: { id: true, email: true, fullName: true, role: true },
      },
      assignee: {
        select: { id: true, email: true, fullName: true, role: true },
      },
      comments: {
        take: 5,
        orderBy: { createdAt: 'desc' as const },
        include: {
          author: { select: { id: true, fullName: true, email: true } },
        },
      },
    };
  }
}
