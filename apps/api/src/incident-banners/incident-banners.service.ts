import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { CreateIncidentBannerDto, UpdateIncidentBannerDto } from './dto/create-incident-banner.dto.js';

@Injectable()
export class IncidentBannersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async findActive() {
    return this.prisma.incidentBanner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.incidentBanner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.incidentBanner.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
    if (!banner) {
      throw new NotFoundException(`Incident banner with ID "${id}" not found`);
    }
    return banner;
  }

  async create(dto: CreateIncidentBannerDto, authorId: string) {
    const banner = await this.prisma.incidentBanner.create({
      data: {
        title: dto.title,
        message: dto.message,
        severity: dto.severity || 'WARNING',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        affectedServices: dto.affectedServices || [],
        createdById: authorId,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    this.broadcastBannerChange('CREATED', banner);
    return banner;
  }

  async update(id: string, dto: UpdateIncidentBannerDto) {
    await this.findOne(id);

    const banner = await this.prisma.incidentBanner.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.message ? { message: dto.message } : {}),
        ...(dto.severity ? { severity: dto.severity } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.affectedServices ? { affectedServices: dto.affectedServices } : {}),
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    this.broadcastBannerChange('UPDATED', banner);
    return banner;
  }

  async delete(id: string) {
    await this.findOne(id);
    const deleted = await this.prisma.incidentBanner.delete({
      where: { id },
    });

    this.broadcastBannerChange('DELETED', deleted);
    return { success: true, deletedId: id };
  }

  private broadcastBannerChange(action: string, banner: any) {
    if (this.realtimeService) {
      this.realtimeService.emit({
        type: 'INCIDENT_BANNER_CHANGED' as any,
        payload: {
          action,
          banner,
        },
      });
    }
  }
}
