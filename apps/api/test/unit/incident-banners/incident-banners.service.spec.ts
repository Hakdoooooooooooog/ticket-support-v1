import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentBannersService } from '../../../src/incident-banners/incident-banners.service.js';

describe('IncidentBannersService', () => {
  let service: IncidentBannersService;
  let prisma: any;
  let realtimeService: any;

  beforeEach(() => {
    prisma = {
      incidentBanner: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    realtimeService = {
      emit: vi.fn(),
    };
    service = new IncidentBannersService(prisma, realtimeService);
  });

  it('should return active banners ordered by createdAt desc', async () => {
    const mockBanners = [
      { id: 'b-1', title: 'Payment Gateway Degraded', severity: 'WARNING', isActive: true },
    ];
    prisma.incidentBanner.findMany.mockResolvedValue(mockBanners);

    const result = await service.findActive();

    expect(prisma.incidentBanner.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: expect.any(Object),
    });
    expect(result).toEqual(mockBanners);
  });

  it('should create banner and broadcast realtime event', async () => {
    const newBanner = {
      id: 'b-2',
      title: 'Scheduled Maintenance',
      message: 'Servers updating at 2 AM UTC',
      severity: 'INFO',
      isActive: true,
      affectedServices: ['API', 'Webhooks'],
      createdById: 'admin-1',
    };
    prisma.incidentBanner.create.mockResolvedValue(newBanner);

    const result = await service.create(
      {
        title: newBanner.title,
        message: newBanner.message,
        severity: 'INFO',
        isActive: true,
        affectedServices: ['API', 'Webhooks'],
      },
      'admin-1',
    );

    expect(prisma.incidentBanner.create).toHaveBeenCalled();
    expect(realtimeService.emit).toHaveBeenCalledWith({
      type: 'INCIDENT_BANNER_CHANGED',
      payload: {
        action: 'CREATED',
        banner: newBanner,
      },
    });
    expect(result).toEqual(newBanner);
  });

  it('should toggle active state and broadcast realtime update', async () => {
    const existing = { id: 'b-1', title: 'Outage', isActive: true };
    prisma.incidentBanner.findUnique.mockResolvedValue(existing);
    prisma.incidentBanner.update.mockResolvedValue({ ...existing, isActive: false });

    const result = await service.update('b-1', { isActive: false });

    expect(result.isActive).toBe(false);
    expect(realtimeService.emit).toHaveBeenCalledWith({
      type: 'INCIDENT_BANNER_CHANGED',
      payload: {
        action: 'UPDATED',
        banner: expect.objectContaining({ isActive: false }),
      },
    });
  });

  it('should delete banner and broadcast deletion', async () => {
    const existing = { id: 'b-1', title: 'Outage' };
    prisma.incidentBanner.findUnique.mockResolvedValue(existing);
    prisma.incidentBanner.delete.mockResolvedValue(existing);

    const result = await service.delete('b-1');

    expect(result.success).toBe(true);
    expect(realtimeService.emit).toHaveBeenCalledWith({
      type: 'INCIDENT_BANNER_CHANGED',
      payload: {
        action: 'DELETED',
        banner: existing,
      },
    });
  });
});
