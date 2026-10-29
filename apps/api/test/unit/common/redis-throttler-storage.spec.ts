import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisThrottlerStorage } from '../../../src/common/throttler/redis-throttler-storage.js';

describe('RedisThrottlerStorage', () => {
  it('increments hits and tracks timeToExpire using in-memory fallback', async () => {
    const storage = new RedisThrottlerStorage();

    const record1 = await storage.increment('test-ip', 60000, 5, 0, 'default');
    expect(record1.totalHits).toBe(1);
    expect(record1.isBlocked).toBe(false);
    expect(record1.timeToExpire).toBeGreaterThan(0);

    const record2 = await storage.increment('test-ip', 60000, 5, 0, 'default');
    expect(record2.totalHits).toBe(2);
    expect(record2.isBlocked).toBe(false);
  });

  it('marks record as blocked when hits exceed limit', async () => {
    const storage = new RedisThrottlerStorage();

    for (let i = 0; i < 3; i++) {
      await storage.increment('ip-limit', 60000, 3, 30000, 'auth');
    }

    const overLimit = await storage.increment('ip-limit', 60000, 3, 30000, 'auth');
    expect(overLimit.totalHits).toBe(4);
    expect(overLimit.isBlocked).toBe(true);
    expect(overLimit.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('delegates to ioredis commands when redis instance is active', async () => {
    const mockRedis = {
      pttl: vi.fn().mockResolvedValue(-2),
      incr: vi.fn().mockResolvedValue(1),
      pexpire: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue('1'),
    };

    const storage = new RedisThrottlerStorage(mockRedis as any);
    const res = await storage.increment('redis-key', 60000, 10, 0, 'login');

    expect(mockRedis.incr).toHaveBeenCalledWith('throttle:login:redis-key');
    expect(mockRedis.pexpire).toHaveBeenCalledWith('throttle:login:redis-key', 60000);
    expect(res.totalHits).toBe(1);
    expect(res.isBlocked).toBe(false);
  });
});
