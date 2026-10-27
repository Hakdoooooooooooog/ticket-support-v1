import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { z } from 'zod';
import { ZodSerializerInterceptor } from '../../../src/common/interceptors/zod-serializer.interceptor.js';

describe('ZodSerializerInterceptor', () => {
  let interceptor: ZodSerializerInterceptor;
  let reflector: Reflector;

  const testUserSchema = z
    .object({
      id: z.string(),
      name: z.string(),
      role: z.enum(['ADMIN', 'CUSTOMER']).default('CUSTOMER'),
      secretToken: z.string().optional(),
    })
    .omit({ secretToken: true });

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new ZodSerializerInterceptor(reflector);
  });

  const createMockContext = () => {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
    } as unknown as ExecutionContext;
  };

  it('should pass through data unmodified if no schema metadata is attached', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext();
    const callHandler: CallHandler = {
      handle: () => of({ raw: 'data' }),
    };

    const observable = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(observable);

    expect(result).toEqual({ raw: 'data' });
  });

  it('should parse single object and populate default values while stripping unmapped fields', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(testUserSchema);

    const context = createMockContext();
    const callHandler: CallHandler = {
      handle: () => of({ id: 'u1', name: 'John Doe', secretToken: 'LEAKED_PASSWORD' }),
    };

    const observable = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(observable);

    expect(result.id).toBe('u1');
    expect(result.name).toBe('John Doe');
    expect(result.role).toBe('CUSTOMER');
    expect((result as any).secretToken).toBeUndefined();
  });

  it('should parse an array of objects and apply schema to each element', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(testUserSchema);

    const context = createMockContext();
    const callHandler: CallHandler = {
      handle: () =>
        of([
          { id: 'u1', name: 'User 1' },
          { id: 'u2', name: 'User 2', role: 'ADMIN' },
        ]),
    };

    const observable = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(observable);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 'u1', name: 'User 1', role: 'CUSTOMER' });
    expect(result[1]).toEqual({ id: 'u2', name: 'User 2', role: 'ADMIN' });
  });

  it('should handle null or undefined data without throwing errors', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(testUserSchema);

    const context = createMockContext();
    const callHandler: CallHandler = {
      handle: () => of(null),
    };

    const observable = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(observable);

    expect(result).toBeNull();
  });
});
