import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/common/guards/roles.guard.js';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator.js';

function buildContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const withRoles = (roles: string[] | undefined) => {
    reflector.getAllAndOverride = ((key: string) =>
      key === ROLES_KEY ? roles : undefined) as Reflector['getAllAndOverride'];
  };

  it('allows any authenticated user when no roles are declared', () => {
    withRoles(undefined);
    expect(guard.canActivate(buildContext({ id: 'u1', role: 'CUSTOMER' }))).toBe(true);
  });

  it('allows a user whose role is in the declared list', () => {
    withRoles(['ADMIN', 'AGENT']);
    expect(guard.canActivate(buildContext({ id: 'u1', role: 'AGENT' }))).toBe(true);
  });

  it('rejects a user whose role is not in the declared list with 403', () => {
    withRoles(['ADMIN']);
    expect(() => guard.canActivate(buildContext({ id: 'u1', role: 'AGENT' }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a request without an authenticated user with 401 when roles are declared', () => {
    withRoles(['ADMIN']);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(UnauthorizedException);
  });
});
