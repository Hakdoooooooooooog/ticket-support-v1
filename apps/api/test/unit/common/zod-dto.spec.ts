import { describe, it, expect } from 'vitest';
import { CreateTicketDto } from '../../../src/tickets/dto/create-ticket.dto.js';
import { UpdateTicketDto } from '../../../src/tickets/dto/update-ticket.dto.js';
import { RegisterDto } from '../../../src/auth/dto/register.dto.js';
import { LoginDto } from '../../../src/auth/dto/login.dto.js';

describe('createZodDto application DTOs', () => {
  describe('CreateTicketDto', () => {
    it('should validate and create valid CreateTicketDto instances with default priority', () => {
      const parsed = CreateTicketDto.create({
        title: 'Network connectivity failure in cluster',
        description: 'Nodes are failing health checks periodically every 5 minutes.',
      });

      expect(parsed.title).toBe('Network connectivity failure in cluster');
      expect(parsed.priority).toBe('MEDIUM');
    });

    it('should expose OpenAPI metadata factory for Swagger', () => {
      expect(CreateTicketDto._OPENAPI_METADATA_FACTORY).toBeDefined();
      const metadata = CreateTicketDto._OPENAPI_METADATA_FACTORY();
      expect(metadata).toBeDefined();
    });
  });

  describe('UpdateTicketDto', () => {
    it('should parse optional fields cleanly', () => {
      const parsed = UpdateTicketDto.create({
        status: 'RESOLVED',
      });

      expect(parsed.status).toBe('RESOLVED');
      expect(parsed.title).toBeUndefined();
    });
  });

  describe('RegisterDto & LoginDto', () => {
    it('should validate RegisterDto and normalize email', () => {
      const parsed = RegisterDto.create({
        fullName: 'Jane Doe',
        email: 'JANE.DOE@example.com',
        password: 'SecurePassword123!',
      });

      expect(parsed.email).toBe('jane.doe@example.com');
      expect(parsed.fullName).toBe('Jane Doe');
    });

    it('should validate LoginDto', () => {
      const parsed = LoginDto.create({
        email: 'user@example.com',
        password: 'MyPassword',
      });

      expect(parsed.email).toBe('user@example.com');
      expect(parsed.password).toBe('MyPassword');
    });
  });
});
