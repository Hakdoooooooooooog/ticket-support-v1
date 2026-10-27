import { describe, it, expect } from 'vitest';
import { AuthMapper } from '../../../src/auth/mappers/auth.mapper.js';

describe('AuthMapper', () => {
  it('should normalize email to lowercase in toRegisterInput', () => {
    const rawRegister = {
      fullName: 'John Smith',
      email: 'John.SMITH@Company.COM',
      password: 'StrongPassword123!',
    };

    const input = AuthMapper.toRegisterInput(rawRegister);

    expect(input.email).toBe('john.smith@company.com');
    expect(input.fullName).toBe('John Smith');
  });

  it('should strip passwordHash completely from UserResponseDto', () => {
    const rawPrismaUser = {
      id: 'usr_999',
      email: 'security.check@example.com',
      fullName: 'Security Tester',
      passwordHash: '$2b$10$superSecretHashedPasswordThatMustNeverLeak',
      role: 'CUSTOMER',
      createdAt: new Date('2026-10-27T08:00:00.000Z'),
    };

    const responseDto = AuthMapper.toUserResponseDto(rawPrismaUser);

    expect(responseDto.id).toBe('usr_999');
    expect(responseDto.email).toBe('security.check@example.com');
    expect(responseDto.createdAt).toBe('2026-10-27T08:00:00.000Z');
    expect((responseDto as any).passwordHash).toBeUndefined();
  });

  it('should populate default role CUSTOMER when role is omitted in raw user', () => {
    const userWithoutRole = {
      id: 'usr_888',
      email: 'default.role@example.com',
      fullName: 'Default Role User',
      createdAt: '2026-10-27T08:00:00.000Z',
    };

    const responseDto = AuthMapper.toUserResponseDto(userWithoutRole);

    expect(responseDto.role).toBe('CUSTOMER');
  });
});
