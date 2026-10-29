import { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  private redis: Redis | null = null;
  private isConnected = false;
  private memoryFallback = new Map<
    string,
    { hits: number; expiresAt: number; blockExpiresAt?: number }
  >();

  constructor(redisOrUrl?: Redis | string) {
    if (typeof redisOrUrl === 'string') {
      try {
        this.redis = new Redis(redisOrUrl, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
        this.redis.on('connect', () => {
          this.isConnected = true;
        });
        this.redis.on('error', () => {
          this.isConnected = false;
        });
        this.redis.connect().catch(() => {
          this.isConnected = false;
        });
      } catch {
        this.isConnected = false;
      }
    } else if (redisOrUrl && typeof (redisOrUrl as Redis).incr === 'function') {
      this.redis = redisOrUrl as Redis;
      this.isConnected = true;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis && this.isConnected) {
      try {
        const redisKey = `throttle:${throttlerName}:${key}`;
        const blockKey = `throttle:block:${throttlerName}:${key}`;

        const blockTtl = await this.redis.pttl(blockKey);
        if (blockTtl > 0) {
          const hits = Number(await this.redis.get(redisKey)) || limit + 1;
          return {
            totalHits: hits,
            timeToExpire: Math.ceil(blockTtl / 1000),
            isBlocked: true,
            timeToBlockExpire: Math.ceil(blockTtl / 1000),
          };
        }

        const hits = await this.redis.incr(redisKey);
        if (hits === 1) {
          await this.redis.pexpire(redisKey, ttl);
        }
        const pttl = await this.redis.pttl(redisKey);
        const timeToExpire = Math.max(0, Math.ceil(pttl / 1000));

        if (hits > limit) {
          if (blockDuration > 0) {
            await this.redis.set(blockKey, '1', 'PX', blockDuration);
            return {
              totalHits: hits,
              timeToExpire,
              isBlocked: true,
              timeToBlockExpire: Math.ceil(blockDuration / 1000),
            };
          }
          return {
            totalHits: hits,
            timeToExpire,
            isBlocked: true,
            timeToBlockExpire: 0,
          };
        }

        return {
          totalHits: hits,
          timeToExpire,
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      } catch {
        // Fall through to memory fallback on temporary redis failure
      }
    }

    return this.memoryIncrement(key, ttl, limit, blockDuration, throttlerName);
  }

  private memoryIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const memoryKey = `${throttlerName}:${key}`;
    const now = Date.now();
    const entry = this.memoryFallback.get(memoryKey);

    if (entry) {
      if (entry.blockExpiresAt && entry.blockExpiresAt > now) {
        const remainingBlock = Math.ceil((entry.blockExpiresAt - now) / 1000);
        return {
          totalHits: entry.hits,
          timeToExpire: remainingBlock,
          isBlocked: true,
          timeToBlockExpire: remainingBlock,
        };
      }

      if (entry.expiresAt > now) {
        entry.hits += 1;
        const timeToExpire = Math.ceil((entry.expiresAt - now) / 1000);
        if (entry.hits > limit) {
          if (blockDuration > 0) {
            entry.blockExpiresAt = now + blockDuration;
            return {
              totalHits: entry.hits,
              timeToExpire,
              isBlocked: true,
              timeToBlockExpire: Math.ceil(blockDuration / 1000),
            };
          }
          return {
            totalHits: entry.hits,
            timeToExpire,
            isBlocked: true,
            timeToBlockExpire: 0,
          };
        }
        return {
          totalHits: entry.hits,
          timeToExpire,
          isBlocked: false,
          timeToBlockExpire: 0,
        };
      }
    }

    const expiresAt = now + ttl;
    this.memoryFallback.set(memoryKey, { hits: 1, expiresAt });
    return {
      totalHits: 1,
      timeToExpire: Math.ceil(ttl / 1000),
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}
