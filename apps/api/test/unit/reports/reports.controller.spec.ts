import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsController } from '../../../src/reports/reports.controller.js';
import { ReportsService } from '../../../src/reports/reports.service.js';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: {
    getSummary: ReturnType<typeof vi.fn>;
    exportTicketsCsv: ReturnType<typeof vi.fn>;
    exportCsatCsv: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getSummary: vi.fn(),
      exportTicketsCsv: vi.fn(),
      exportCsatCsv: vi.fn(),
    };
    controller = new ReportsController(service as unknown as ReportsService);
  });

  it('should return summary from service', async () => {
    const mockSummary = { kpis: { totalTickets: 5 } };
    service.getSummary.mockResolvedValue(mockSummary);

    const result = await controller.getSummary({ user: { id: 'admin-1', role: 'ADMIN' } });
    expect(result).toEqual(mockSummary);
  });

  it('should stream tickets CSV with proper headers', async () => {
    service.exportTicketsCsv.mockResolvedValue('"ID","Title"\r\n"1","Test"');
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await controller.exportTicketsCsv(
      res as any,
      'OPEN',
      'HIGH',
      'TECHNICAL_SUPPORT',
      undefined,
      undefined,
      { user: { id: 'admin-1', role: 'ADMIN' } },
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="tickets-export-'),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('"ID","Title"\r\n"1","Test"');
  });
});
