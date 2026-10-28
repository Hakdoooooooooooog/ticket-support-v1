import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { RealtimeController } from '../../../src/realtime/realtime.controller.js';
import { RealtimeService } from '../../../src/realtime/realtime.service.js';

describe('RealtimeController', () => {
  it('delegates stream request to realtimeService.getUserStream with authenticated user', () => {
    const mockObservable = of({ data: JSON.stringify({ type: 'HEARTBEAT' }) });
    const mockRealtimeService = {
      getUserStream: vi.fn().mockReturnValue(mockObservable),
    };

    const controller = new RealtimeController(
      mockRealtimeService as unknown as RealtimeService,
    );

    const user = { id: 'user-1', email: 'test@example.com', role: 'ADMIN' as const };
    const result = controller.stream({ user });

    expect(mockRealtimeService.getUserStream).toHaveBeenCalledWith(user);
    expect(result).toBe(mockObservable);
  });
});
