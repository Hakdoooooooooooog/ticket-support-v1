import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketMapper } from './mappers/ticket.mapper.js';
import { TicketResponseDto } from './schemas/ticket.schema.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const user = await this.resolveCreatorUser(creatorId);

    const createData = TicketMapper.toCreateInput(dto, user.id);

    const record = await this.prisma.ticket.create({
      data: createData,
      include: this.standardTicketInclude,
    });

    return TicketMapper.toResponseDto(record);
  }

  async update(id: string, dto: UpdateTicketDto): Promise<TicketResponseDto> {
    await this.findOne(id);

    const updateData = TicketMapper.toUpdateInput(dto);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData as any,
      include: this.standardTicketInclude,
    });

    return TicketMapper.toResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.ticket.delete({
      where: { id },
    });
  }

  /**
   * Resolves the author/creator User model. If not found or omitted,
   * creates or retrieves a safe fallback demo customer.
   */
  protected async resolveCreatorUser(creatorId?: string) {
    if (creatorId) {
      const user = await this.prisma.user.findUnique({ where: { id: creatorId } });
      if (user) return user;
    }

    return this.prisma.user.upsert({
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
