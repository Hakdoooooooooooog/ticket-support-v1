import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  const mockDate = new Date('2026-10-27T09:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new customer and return a sanitized profile without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: 'newuser@example.com',
        fullName: 'New Customer',
        passwordHash: '$2b$10$hashedPassword',
        role: 'CUSTOMER',
        createdAt: mockDate,
      });

      const registerDto = {
        fullName: 'New Customer',
        email: 'NEWUSER@example.com',
        password: 'SecurePassword123!',
      };

      const result = await service.register(registerDto as any);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'newuser@example.com',
          fullName: 'New Customer',
          passwordHash: expect.any(String),
          role: 'CUSTOMER',
        },
      });
      expect(result.message).toBe('User registered successfully');
      expect(result.user.id).toBe('user-new');
      expect(result.user.email).toBe('newuser@example.com');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id' });

      const registerDto = {
        fullName: 'Duplicate User',
        email: 'existing@example.com',
        password: 'Password123!',
      };

      await expect(service.register(registerDto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return access token when credentials match', async () => {
      const plainPassword = 'CorrectPassword123!';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(plainPassword, salt);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-auth-id',
        email: 'login@example.com',
        fullName: 'Valid User',
        passwordHash,
        role: 'CUSTOMER',
        createdAt: mockDate,
      });

      const loginDto = {
        email: 'LOGIN@example.com',
        password: plainPassword,
      };

      const result = await service.login(loginDto);

      expect(result.accessToken.split('.')).toHaveLength(3);
      const decodedPayload = JSON.parse(
        Buffer.from(result.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(decodedPayload.sub).toBe('user-auth-id');
      expect(decodedPayload.email).toBe('login@example.com');
      expect(result.user.email).toBe('login@example.com');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException if email is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@example.com', password: 'SomePassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const realPasswordHash = await bcrypt.hash('RealPassword123!', 10);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-auth-id',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: realPasswordHash,
        role: 'CUSTOMER',
        createdAt: mockDate,
      });

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
