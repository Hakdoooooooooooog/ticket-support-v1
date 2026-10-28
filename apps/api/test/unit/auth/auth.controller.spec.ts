import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../../src/auth/auth.controller.js';
import { AuthService } from '../../../src/auth/auth.service.js';
import { Reflector } from '@nestjs/core';

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    findAgents: ReturnType<typeof vi.fn>;
    verifyInviteCode: ReturnType<typeof vi.fn>;
    createInvite: ReturnType<typeof vi.fn>;
    listInvites: ReturnType<typeof vi.fn>;
    revokeInvite: ReturnType<typeof vi.fn>;
    adminCreateUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      register: vi.fn(),
      login: vi.fn(),
      findAgents: vi.fn(),
      verifyInviteCode: vi.fn(),
      createInvite: vi.fn(),
      listInvites: vi.fn(),
      revokeInvite: vi.fn(),
      adminCreateUser: vi.fn(),
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

  describe('register', () => {
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
  });

  describe('login', () => {
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

  describe('getProfile', () => {
    it('should return the authenticated user from the request', () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'AGENT' as const,
      };

      const result = controller.getProfile({ user: mockUser });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getAgents', () => {
    it('should delegate findAgents to authService', async () => {
      const mockAgents = [
        { id: 'agent-1', fullName: 'Tech Agent', email: 'agent@example.com', role: 'AGENT' },
      ];
      service.findAgents.mockResolvedValue(mockAgents);

      const result = await controller.getAgents();
      expect(service.findAgents).toHaveBeenCalled();
      expect(result).toEqual(mockAgents);
    });
  });

  describe('verifyInvite', () => {
    it('should delegate verifyInviteCode to authService', async () => {
      const mockVerification = {
        valid: true,
        email: 'invitee@example.com',
        role: 'AGENT' as const,
      };
      service.verifyInviteCode.mockResolvedValue(mockVerification);

      const result = await controller.verifyInvite('INVITE-CODE-123');
      expect(service.verifyInviteCode).toHaveBeenCalledWith('INVITE-CODE-123');
      expect(result).toEqual(mockVerification);
    });
  });

  describe('createInvite', () => {
    it('should delegate createInvite to authService with user context', async () => {
      const mockInvite = {
        id: 'inv-1',
        email: 'newagent@example.com',
        role: 'AGENT' as const,
        code: 'INVITE-CODE-ABC',
      };
      service.createInvite.mockResolvedValue(mockInvite);

      const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
      const dto = { email: 'newagent@example.com', role: 'AGENT' as const };

      const result = await controller.createInvite(dto, { user: adminUser });
      expect(service.createInvite).toHaveBeenCalledWith(dto, adminUser);
      expect(result).toEqual(mockInvite);
    });
  });

  describe('listInvites', () => {
    it('should delegate listInvites to authService', async () => {
      const mockInvites = [
        { id: 'inv-1', email: 'staff@example.com', role: 'AGENT', status: 'PENDING' },
      ];
      service.listInvites.mockResolvedValue(mockInvites);

      const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
      const result = await controller.listInvites({ user: adminUser });

      expect(service.listInvites).toHaveBeenCalledWith(adminUser);
      expect(result).toEqual(mockInvites);
    });
  });

  describe('revokeInvite', () => {
    it('should delegate revokeInvite to authService', async () => {
      service.revokeInvite.mockResolvedValue({ success: true, message: 'Revoked' });

      const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
      const result = await controller.revokeInvite('inv-1', { user: adminUser });

      expect(service.revokeInvite).toHaveBeenCalledWith('inv-1', adminUser);
      expect(result).toEqual({ success: true, message: 'Revoked' });
    });
  });

  describe('adminCreateUser', () => {
    it('should delegate adminCreateUser to authService', async () => {
      const mockCreated = {
        id: 'staff-1',
        email: 'staff@example.com',
        fullName: 'Staff Member',
        role: 'AGENT',
      };
      service.adminCreateUser.mockResolvedValue(mockCreated);

      const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const };
      const dto = {
        email: 'staff@example.com',
        fullName: 'Staff Member',
        password: 'Password123!',
        role: 'AGENT' as const,
      };

      const result = await controller.adminCreateUser(dto, { user: adminUser });
      expect(service.adminCreateUser).toHaveBeenCalledWith(dto, adminUser);
      expect(result).toEqual(mockCreated);
    });
  });
});
