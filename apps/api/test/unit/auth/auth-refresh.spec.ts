import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { createHash } from 'node:crypto';

describe('AuthService - Refresh Token Rotation & Session Security', () => {
  let service: AuthService;
  let mockPrisma: any;
  let tokensDb: any[];

  beforeEach(() => {
    tokensDb = [];

    mockPrisma = {
      refreshToken: {
        create: vi.fn(async (args: any) => {
          const rec = {
            id: `rt-id-${Date.now()}-${Math.random()}`,
            ...args.data,
            revokedAt: null,
            replacedById: null,
            createdAt: new Date(),
          };
          tokensDb.push(rec);
          return rec;
        }),
        findUnique: vi.fn(async (args: any) => {
          const rec = tokensDb.find((t) => t.tokenHash === args.where.tokenHash);
          if (!rec) return null;
          return {
            ...rec,
            user: {
              id: rec.userId,
              email: 'alice@example.com',
              fullName: 'Alice Walker',
              role: 'CUSTOMER',
              createdAt: new Date().toISOString(),
            },
          };
        }),
        update: vi.fn(async (args: any) => {
          const t = tokensDb.find((x) => x.id === args.where.id);
          if (t) {
            Object.assign(t, args.data);
          }
          return t;
        }),
        updateMany: vi.fn(async (args: any) => {
          let count = 0;
          for (const t of tokensDb) {
            if (args.where.familyId && t.familyId === args.where.familyId) {
              Object.assign(t, args.data);
              count++;
            } else if (args.where.tokenHash && t.tokenHash === args.where.tokenHash) {
              Object.assign(t, args.data);
              count++;
            }
          }
          return { count };
        }),
      },
      user: {
        findUnique: vi.fn(async (args: any) => {
          return {
            id: args.where.id || 'user-1',
            email: 'alice@example.com',
            fullName: 'Alice Walker',
            role: 'CUSTOMER',
            createdAt: new Date(),
          };
        }),
      },
    };

    service = new AuthService(mockPrisma as unknown as PrismaService);
  });

  it('generates a cryptographically secure refresh token', async () => {
    const { rawToken, tokenRecord } = await service.generateRefreshToken('user-1');

    expect(rawToken.startsWith('rt_')).toBe(true);
    expect(tokenRecord.userId).toBe('user-1');
    expect(tokenRecord.familyId).toBeDefined();
    expect(tokensDb).toHaveLength(1);
  });

  it('rotates refresh token and returns a fresh access token', async () => {
    const { rawToken: initialToken } = await service.generateRefreshToken('user-1');
    const initialRecord = tokensDb[0];

    const result = await service.refreshSession(initialToken);

    expect(result.accessToken).toBeDefined();
    expect(result.user.id).toBe('user-1');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe(initialToken);

    // Old token should now be revoked and point to replacement
    expect(initialRecord.revokedAt).not.toBeNull();
    expect(initialRecord.replacedById).toBeDefined();

    // New token exists in db with same familyId
    expect(tokensDb).toHaveLength(2);
    expect(tokensDb[1].familyId).toBe(initialRecord.familyId);
  });

  it('detects token reuse and revokes entire family when revoked token is presented', async () => {
    const { rawToken: token1 } = await service.generateRefreshToken('user-1');
    const rotated = await service.refreshSession(token1);

    // token1 is now revoked. Attempting to use token1 again indicates token theft/replay!
    await expect(service.refreshSession(token1)).rejects.toThrow(
      /Session compromised/i,
    );

    // Every token in the family must now be revoked
    for (const t of tokensDb) {
      expect(t.revokedAt).not.toBeNull();
    }

    // Even the legitimately rotated token is now blocked
    await expect(service.refreshSession(rotated.refreshToken)).rejects.toThrow(
      /Session compromised/i,
    );
  });

  it('rejects expired refresh tokens', async () => {
    const { rawToken } = await service.generateRefreshToken('user-1');
    tokensDb[0].expiresAt = new Date(Date.now() - 1000); // Expired in past

    await expect(service.refreshSession(rawToken)).rejects.toThrow(
      /Refresh token has expired/i,
    );
  });

  it('revokes token on logout', async () => {
    const { rawToken } = await service.generateRefreshToken('user-1');
    const initialRecord = tokensDb[0];

    await service.logout(rawToken);

    expect(initialRecord.revokedAt).not.toBeNull();
  });
});
