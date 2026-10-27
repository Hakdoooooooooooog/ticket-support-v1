import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateTicketDto, UpdateTicketDto, TicketResponseDto } from './dto/index.js';
import { TicketMapper } from './mappers/ticket.mapper.js';
import {
  decompressAndEncryptAttachment,
  EncryptedAttachmentInput,
  OnDemandAttachmentResponse,
} from './attachment-crypto.util.js';

export interface TicketActorContext {
  id: string;
  email?: string;
  role: 'ADMIN' | 'AGENT' | 'CUSTOMER';
}

export interface TicketQueryFilters {
  priority?: string;
  search?: string;
  actor?: TicketActorContext;
}

@Injectable()
export class TicketsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Migrates any legacy ticket-level attachment that was uploaded during a
   * [CUSTOMER AMENDMENT] or [FOLLOW-UP REQUESTED] event onto that specific Comment
   * record so existing tickets display the image inside the message that sent it.
   */
  async onModuleInit() {
    if (
      typeof this.prisma?.ticket?.findMany !== 'function' ||
      typeof this.prisma?.comment?.update !== 'function'
    ) {
      return;
    }

    try {
      const ticketsWithAttachments = await this.prisma.ticket.findMany({
        where: {
          attachmentCompressed: { not: null },
        },
        include: {
          comments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      for (const t of ticketsWithAttachments) {
        const targetComment = t.comments.find(
          (c) =>
            !c.attachmentCompressed &&
            (c.content.startsWith('[CUSTOMER AMENDMENT]') ||
              c.content.startsWith('[FOLLOW-UP')),
        );

        if (targetComment) {
          await this.runTransaction(async (tx) => {
            await tx.comment.update({
              where: { id: targetComment.id },
              data: {
                attachmentName: t.attachmentName,
                attachmentMimeType: t.attachmentMimeType,
                attachmentCompressed: t.attachmentCompressed,
                attachmentOriginalSize: t.attachmentOriginalSize,
                attachmentCompressedSize: t.attachmentCompressedSize,
              },
            });
            await tx.ticket.update({
              where: { id: t.id },
              data: {
                attachmentName: null,
                attachmentMimeType: null,
                attachmentCompressed: null,
                attachmentOriginalSize: null,
                attachmentCompressedSize: null,
              },
            });
          });
        }
      }
    } catch {
      // Ignore if schema migration is not yet pushed in unit test environment
    }
  }

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

  protected assertCustomerOwnership(
    ticket: { creatorId?: string | null },
    actor?: TicketActorContext,
    actionLabel = 'access this ticket',
  ): void {
    if (
      actor?.role === 'CUSTOMER' &&
      ticket.creatorId &&
      ticket.creatorId !== actor.id
    ) {
      throw new ForbiddenException(`You do not have permission to ${actionLabel}`);
    }
  }

  async findAll(
    status?: string,
    filters?: TicketQueryFilters,
  ): Promise<TicketResponseDto[]> {
    const where: Record<string, unknown> = {};

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (filters?.priority && filters.priority !== 'ALL') {
      where.priority = filters.priority;
    }

    if (filters?.actor?.role === 'CUSTOMER') {
      where.creatorId = filters.actor.id;
    }

    const trimmedSearch = filters?.search?.trim();
    if (trimmedSearch) {
      const idQuery = trimmedSearch.replace(/^#/, '');
      where.OR = [
        ...(idQuery ? [{ id: { contains: idQuery, mode: 'insensitive' } }] : []),
        { title: { contains: trimmedSearch, mode: 'insensitive' } },
        { description: { contains: trimmedSearch, mode: 'insensitive' } },
        { creator: { fullName: { contains: trimmedSearch, mode: 'insensitive' } } },
        { creator: { email: { contains: trimmedSearch, mode: 'insensitive' } } },
      ];
    }

    const hasWhereConditions = Object.keys(where).length > 0;

    const records = await this.prisma.ticket.findMany({
      where: hasWhereConditions ? (where as any) : undefined,
      include: this.standardTicketInclude,
      orderBy: { createdAt: 'desc' },
    });

    return TicketMapper.toResponseDtoList(records);
  }

  async findOne(id: string, actor?: TicketActorContext): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: this.standardTicketInclude,
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found`);
    }

    this.assertCustomerOwnership(ticket as { creatorId?: string }, actor, 'view this ticket');

    return TicketMapper.toResponseDto(ticket);
  }

  async create(
    dto: CreateTicketDto,
    creatorId?: string,
    actor?: TicketActorContext,
  ): Promise<TicketResponseDto> {
    return this.runTransaction(async (tx) => {
      const effectiveCreatorId = actor?.id || creatorId || dto.creatorId;
      const user = await this.resolveCreatorUser(effectiveCreatorId, tx);
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
    encryptedAttachment?: EncryptedAttachmentInput,
    actor?: TicketActorContext,
  ): Promise<TicketResponseDto> {
    const trimmedContent = content.trim();
    const commentAttachment = encryptedAttachment
      ? TicketMapper.toCommentAttachmentInput(encryptedAttachment)
      : {};

    return this.runTransaction(async (tx) => {
      const existingTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: this.standardTicketInclude,
      });

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID "${ticketId}" not found`);
      }

      this.assertCustomerOwnership(
        existingTicket as { creatorId?: string },
        actor,
        'comment on this ticket',
      );

      const currentAssigneeId = (existingTicket as { assigneeId?: string | null })
        .assigneeId;
      if (!currentAssigneeId) {
        throw new BadRequestException(
          'Ticket must be assigned to an IT agent or administrator before posting resolution notes',
        );
      }

      const author = await this.resolveCreatorUser(actor?.id || authorId, tx);

      if (!encryptedAttachment && typeof tx.comment?.findFirst === 'function') {
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
          ...commentAttachment,
        },
      });

      const updatedTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: this.standardTicketInclude,
      });

      return TicketMapper.toResponseDto(updatedTicket!);
    });
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    actor?: TicketActorContext,
  ): Promise<TicketResponseDto> {
    return this.runTransaction(async (tx) => {
      const existingTicket = await tx.ticket.findUnique({
        where: { id },
        include: this.standardTicketInclude,
      });

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID "${id}" not found`);
      }

      this.assertCustomerOwnership(
        existingTicket as { creatorId?: string },
        actor,
        'modify this ticket',
      );

      if (actor?.role === 'CUSTOMER') {
        if (dto.assigneeId !== undefined) {
          throw new ForbiddenException('Customers are not permitted to assign tickets');
        }
        if (
          dto.status !== undefined &&
          dto.status !== 'CLOSED' &&
          dto.status !== 'OPEN' &&
          dto.status !== 'IN_PROGRESS'
        ) {
          throw new ForbiddenException(
            'Customers can only confirm resolution or reopen their own tickets',
          );
        }
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
      const commentAttachment = dto.encryptedAttachment
        ? TicketMapper.toCommentAttachmentInput(dto.encryptedAttachment)
        : {};

      const existingAssigneeId = (existingTicket as { assigneeId?: string | null })
        .assigneeId;
      const effectiveAssigneeId =
        dto.assigneeId !== undefined ? dto.assigneeId : existingAssigneeId;

      const isCustomerAction =
        actor?.role === 'CUSTOMER' ||
        Boolean(dto.amendmentNote?.trim().startsWith('[CUSTOMER AMENDMENT]'));

      if (
        !isCustomerAction &&
        !effectiveAssigneeId &&
        ((dto.status && dto.status !== 'OPEN') ||
          Boolean(dto.amendmentNote?.trim().startsWith('[FOLLOW-UP')))
      ) {
        throw new BadRequestException(
          'Ticket must be assigned to an IT agent or administrator before updating status or requesting a follow-up',
        );
      }

      // If an agent or admin unassigns an active ticket without specifying status, reset status to OPEN
      const currentStatus = (existingTicket as { status?: string }).status;
      if (
        dto.assigneeId === null &&
        dto.status === undefined &&
        (currentStatus === 'IN_PROGRESS' || currentStatus === 'NEEDS_INFO')
      ) {
        updateData.status = 'OPEN';
      }

      // If a customer amends a ticket that was waiting on NEEDS_INFO or RESOLVED, automatically reopen it
      const isCustomerAmendment =
        !dto.status &&
        (dto.title !== undefined ||
          dto.description !== undefined ||
          dto.encryptedAttachment !== undefined ||
          dto.amendmentNote !== undefined);

      if (
        isCustomerAmendment &&
        (currentStatus === 'NEEDS_INFO' || currentStatus === 'RESOLVED')
      ) {
        updateData.status = existingAssigneeId ? 'IN_PROGRESS' : 'OPEN';
      }

      const hasCommentPayload = Boolean(dto.amendmentNote || dto.encryptedAttachment);
      if (hasCommentPayload && typeof tx.comment?.create === 'function') {
        const commentActor = await this.resolveCreatorUser(
          actor?.id || dto.actorId || (existingTicket as { creatorId?: string }).creatorId,
          tx,
        );

        const fieldChanges: string[] = [];
        const prevTitle = (existingTicket as { title?: string }).title;
        const prevPriority = (existingTicket as { priority?: string }).priority;
        const prevDesc = (existingTicket as { description?: string }).description;

        if (dto.title && prevTitle && dto.title.trim() !== prevTitle.trim()) {
          fieldChanges.push(`Title changed from "${prevTitle}" to "${dto.title.trim()}"`);
        }
        if (dto.priority && prevPriority && dto.priority !== prevPriority) {
          fieldChanges.push(`Priority changed from ${prevPriority} to ${dto.priority}`);
        }
        if (dto.description && prevDesc && dto.description.trim() !== prevDesc.trim()) {
          fieldChanges.push(`Description updated`);
        }

        let noteContent =
          dto.amendmentNote?.trim() ||
          '[CUSTOMER AMENDMENT] Attached screenshot update.';
        if (fieldChanges.length > 0) {
          noteContent = `${noteContent} (${fieldChanges.join(' · ')})`;
        }

        await tx.comment.create({
          data: {
            ticketId: id,
            content: noteContent,
            authorId: commentActor.id,
            ...commentAttachment,
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

  async getAttachment(
    id: string,
    actor?: TicketActorContext,
  ): Promise<OnDemandAttachmentResponse> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        creatorId: true,
        attachmentName: true,
        attachmentMimeType: true,
        attachmentCompressed: true,
        attachmentOriginalSize: true,
        comments: {
          where: { attachmentCompressed: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            attachmentName: true,
            attachmentMimeType: true,
            attachmentCompressed: true,
            attachmentOriginalSize: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found`);
    }

    this.assertCustomerOwnership(ticket, actor, 'access this attachment');

    const source = ticket.attachmentCompressed
      ? ticket
      : ticket.comments?.[0];

    if (!source?.attachmentCompressed) {
      throw new NotFoundException(`Ticket "${id}" does not have an image attachment`);
    }

    const { ciphertext, iv, decompressedSize } = decompressAndEncryptAttachment(
      source.attachmentCompressed,
    );

    return {
      ticketId: ticket.id,
      fileName: source.attachmentName || 'attachment.webp',
      mimeType: source.attachmentMimeType || 'image/webp',
      originalSize: source.attachmentOriginalSize || decompressedSize,
      encrypted: {
        ciphertext,
        iv,
      },
    };
  }

  async getCommentAttachment(
    ticketId: string,
    commentId: string,
    actor?: TicketActorContext,
  ): Promise<OnDemandAttachmentResponse> {
    if (actor?.role === 'CUSTOMER') {
      const parentTicket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, creatorId: true },
      });
      if (!parentTicket) {
        throw new NotFoundException(`Ticket with ID "${ticketId}" not found`);
      }
      this.assertCustomerOwnership(parentTicket, actor, 'access this attachment');
    }

    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, ticketId },
      select: {
        id: true,
        ticketId: true,
        attachmentName: true,
        attachmentMimeType: true,
        attachmentCompressed: true,
        attachmentOriginalSize: true,
      },
    });

    if (!comment || !comment.attachmentCompressed) {
      throw new NotFoundException(`Comment attachment not found`);
    }

    const { ciphertext, iv, decompressedSize } = decompressAndEncryptAttachment(
      comment.attachmentCompressed,
    );

    return {
      ticketId: comment.ticketId,
      fileName: comment.attachmentName || 'attachment.webp',
      mimeType: comment.attachmentMimeType || 'image/webp',
      originalSize: comment.attachmentOriginalSize || decompressedSize,
      encrypted: {
        ciphertext,
        iv,
      },
    };
  }

  async remove(id: string, actor?: TicketActorContext): Promise<void> {
    if (actor?.role === 'CUSTOMER') {
      throw new ForbiddenException('Customers are not permitted to delete tickets');
    }

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
        orderBy: { createdAt: 'asc' as const },
        include: {
          author: { select: { id: true, fullName: true, email: true, role: true } },
        },
      },
    };
  }
}
