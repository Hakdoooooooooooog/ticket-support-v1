import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      register: vi.fn(),
      login: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: service,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should delegate register call to authService', async () => {
    const mockResult = {
      message: 'User registered successfully',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'New User',
        role: 'CUSTOMER' as const,
        createdAt: '2026-10-27T10:00:00.000Z',
      },
    };
    service.register.mockResolvedValue(mockResult);

    const dto = {
      fullName: 'New User',
      email: 'user@example.com',
      password: 'Password123!',
    };

    const result = await controller.register(dto as any);

    expect(service.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResult);
  });

  it('should delegate login call to authService', async () => {
    const mockAuthResult = {
      accessToken: 'test-token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'New User',
        role: 'CUSTOMER' as const,
        createdAt: '2026-10-27T10:00:00.000Z',
      },
      message: 'Authenticated successfully',
    };
    service.login.mockResolvedValue(mockAuthResult);

    const dto = {
      email: 'user@example.com',
      password: 'Password123!',
    };

    const result = await controller.login(dto as any);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockAuthResult);
  });
});
