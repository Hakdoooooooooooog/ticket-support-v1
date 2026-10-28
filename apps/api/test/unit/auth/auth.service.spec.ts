import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../../../src/auth/auth.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    invite: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const mockDate = new Date('2026-10-27T09:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      invite: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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

    it('should throw ForbiddenException if public registration attempts to specify AGENT role without invite', async () => {
      const registerDto = {
        fullName: 'Sneaky Agent',
        email: 'agent@example.com',
        password: 'Password123!',
        role: 'AGENT',
      };

      await expect(service.register(registerDto as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should allow staff registration when a valid inviteCode is provided', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        code: 'inv_validcode123',
        role: 'AGENT',
        accepted: false,
        expiresAt: futureDate,
      });
      prisma.invite.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-agent-1',
        email: 'invited@example.com',
        fullName: 'Invited Agent',
        passwordHash: 'hash',
        role: 'AGENT',
        createdAt: mockDate,
      });

      const registerDto = {
        fullName: 'Invited Agent',
        email: 'invited@example.com',
        password: 'Password123!',
        inviteCode: 'inv_validcode123',
      };

      const result = await service.register(registerDto as any);
      expect(result.user.role).toBe('AGENT');
      expect(prisma.invite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ accepted: true }),
        }),
      );
    });

    it('should throw BadRequestException if staff invitation code has expired', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60);
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        code: 'inv_expired',
        role: 'AGENT',
        accepted: false,
        expiresAt: pastDate,
      });

      const registerDto = {
        fullName: 'Late Agent',
        email: 'late@example.com',
        password: 'Password123!',
        inviteCode: 'inv_expired',
      };

      await expect(service.register(registerDto as any)).rejects.toThrow(BadRequestException);
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

  describe('createInvite & adminCreateUser', () => {
    it('should allow ADMIN to generate staff invitations', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
      prisma.invite.create.mockResolvedValue({
        id: 'inv-new',
        email: 'newagent@example.com',
        role: 'AGENT',
        code: 'inv_testcode',
        accepted: false,
        acceptedAt: null,
        createdAt: mockDate,
        expiresAt: new Date(Date.now() + 100000),
        createdById: 'admin-1',
        createdBy: { id: 'admin-1', fullName: 'IT Admin', email: 'admin@example.com' },
      });

      const result = await service.createInvite(
        { email: 'newagent@example.com', role: 'AGENT' },
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(result.email).toBe('newagent@example.com');
      expect(result.role).toBe('AGENT');
      expect(prisma.invite.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if AGENT attempts to create an invitation', async () => {
      await expect(
        service.createInvite(
          { email: 'colleague@example.com', role: 'AGENT' },
          { id: 'agent-1', role: 'AGENT' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to directly provision a staff account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'agent-created',
        email: 'directagent@example.com',
        fullName: 'Direct Agent',
        passwordHash: 'hash',
        role: 'AGENT',
        createdAt: mockDate,
      });

      const result = await service.adminCreateUser(
        {
          fullName: 'Direct Agent',
          email: 'directagent@example.com',
          password: 'Password123!',
          role: 'AGENT',
        },
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(result.email).toBe('directagent@example.com');
      expect(result.role).toBe('AGENT');
    });

    it('should throw ForbiddenException if AGENT attempts to provision a staff account', async () => {
      await expect(
        service.adminCreateUser(
          {
            fullName: 'Direct Agent',
            email: 'directagent@example.com',
            password: 'Password123!',
            role: 'AGENT',
          },
          { id: 'agent-1', role: 'AGENT' },
        ),
      ).rejects.toThrow(ForbiddenException);
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

  describe('Invite Verification & Revocation Lifecycles', () => {
    it('should return valid: false if invite code does not exist', async () => {
      prisma.invite.findUnique.mockResolvedValue(null);

      const res = await service.verifyInviteCode('NONEXISTENT-CODE');
      expect(res.valid).toBe(false);
      expect(res.message).toBe('Invalid invitation code');
    });

    it('should return valid: false if invite code is already claimed', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        code: 'CLAIMED-CODE',
        email: 'claimed@example.com',
        role: 'AGENT',
        accepted: true,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await service.verifyInviteCode('CLAIMED-CODE');
      expect(res.valid).toBe(false);
      expect(res.message).toBe('This invitation has already been redeemed');
    });

    it('should return valid: false if invite code has expired', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        code: 'EXPIRED-CODE',
        email: 'expired@example.com',
        role: 'AGENT',
        accepted: false,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const res = await service.verifyInviteCode('EXPIRED-CODE');
      expect(res.valid).toBe(false);
      expect(res.message).toBe('This invitation has expired');
    });

    it('should return valid invite details when code is active and unclaimed', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        code: 'VALID-CODE',
        email: 'agent@example.com',
        role: 'AGENT',
        accepted: false,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await service.verifyInviteCode('VALID-CODE');
      expect(res.valid).toBe(true);
      expect(res.email).toBe('agent@example.com');
      expect(res.role).toBe('AGENT');
    });

    it('should throw ForbiddenException when non-admin lists invites', async () => {
      await expect(
        service.listInvites({ id: 'agent-1', role: 'AGENT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-admin revokes an invite', async () => {
      await expect(
        service.revokeInvite('inv-1', { id: 'agent-1', role: 'AGENT' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to revoke an existing invite', async () => {
      prisma.invite.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'pending@example.com',
      });
      prisma.invite.delete.mockResolvedValue({ id: 'inv-1' });

      const res = await service.revokeInvite('inv-1', { id: 'admin-1', role: 'ADMIN' });
      expect(res.message).toBe('Invitation revoked successfully');
      expect(prisma.invite.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });
  });
});
