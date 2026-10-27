import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    return this.prisma.ticket.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        creator: {
          select: { id: true, email: true, fullName: true, role: true },
        },
        assignee: {
          select: { id: true, email: true, fullName: true, role: true },
        },
        comments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, email: true, fullName: true, role: true },
        },
        assignee: {
          select: { id: true, email: true, fullName: true, role: true },
        },
        comments: {
          include: {
            author: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found`);
    }

    return ticket;
  }

  async create(dto: CreateTicketDto, creatorId?: string) {
    let user = creatorId ? await this.prisma.user.findUnique({ where: { id: creatorId } }) : null;
    if (!user) {
      user = await this.prisma.user.upsert({
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

    return this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as any) ?? 'MEDIUM',
        creatorId: user.id,
      },
      include: {
        creator: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateTicketDto) {
    await this.findOne(id);
    return this.prisma.ticket.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority as any,
        status: dto.status as any,
      },
      include: {
        creator: { select: { id: true, email: true, fullName: true } },
        assignee: { select: { id: true, email: true, fullName: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.ticket.delete({
      where: { id },
    });
  }
}
