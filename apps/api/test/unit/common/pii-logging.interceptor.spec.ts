import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import {
  PiiRedactingLoggingInterceptor,
  redactPii,
  maskEmail,
  maskName,
  scrubInlinePii,
} from '../../../src/common/interceptors/pii-logging.interceptor.js';

describe('PiiRedactingLoggingInterceptor & PII Utilities', () => {
  describe('maskEmail & maskName', () => {
    it('should mask email local part while preserving domain', () => {
      expect(maskEmail('jane.doe@example.com')).toBe('j***@example.com');
      expect(maskEmail('invalid-email')).toBe('[REDACTED_EMAIL]');
    });

    it('should mask each word of a full name', () => {
      expect(maskName('Jane Marie Doe')).toBe('J*** M*** D***');
    });
  });

  describe('scrubInlinePii', () => {
    it('should scrub inline emails, phone numbers, and Bearer JWTs inside free text', () => {
      const text =
        'Contact user@company.org or call +1-555-234-5678 with Bearer eyJhbGci.eyJzdWI.sig123';
      const scrubbed = scrubInlinePii(text);

      expect(scrubbed).not.toContain('user@company.org');
      expect(scrubbed).toContain('u***@company.org');
      expect(scrubbed).not.toContain('555-234-5678');
      expect(scrubbed).toContain('[REDACTED_PHONE]');
      expect(scrubbed).toContain('Bearer [REDACTED]');
    });
  });

  describe('redactPii', () => {
    it('should recursively redact secrets, emails, and names without mutating original payload', () => {
      const original = {
        email: 'customer@ticketsupport.com',
        fullName: 'Alice Wonderland',
        password: 'SuperSecretPassword!',
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
        nested: {
          description: 'Please email admin@corp.io about my issue',
        },
      };

      const redacted = redactPii(original) as Record<string, any>;

      expect(redacted.email).toBe('c***@ticketsupport.com');
      expect(redacted.fullName).toBe('A*** W***');
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.accessToken).toBe('[REDACTED]');
      expect(redacted.nested.description).toBe('Please email a***@corp.io about my issue');
      // Original must remain untouched
      expect(original.email).toBe('customer@ticketsupport.com');
      expect(original.password).toBe('SuperSecretPassword!');
    });
  });

  describe('PiiRedactingLoggingInterceptor.intercept', () => {
    it('should log PII-redacted request/response while returning unredacted data to caller', async () => {
      const interceptor = new PiiRedactingLoggingInterceptor();
      const logSpy = vi.spyOn((interceptor as any).logger, 'log').mockImplementation(() => {});

      const mockContext: any = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            originalUrl: '/auth/login',
            body: {
              email: 'darenz@example.com',
              password: 'MySecretPassword123!',
            },
          }),
          getResponse: () => ({
            statusCode: 200,
          }),
        }),
      };

      const responsePayload = {
        accessToken: 'jwt.token.value',
        user: {
          id: 'u1',
          email: 'darenz@example.com',
          fullName: 'Darenz Jasper',
        },
      };

      const next = {
        handle: () => of(responsePayload),
      };

      const result = await lastValueFrom(interceptor.intercept(mockContext, next));

      // Caller still receives original unredacted response
      expect(result).toEqual(responsePayload);

      // Logger received strictly redacted string
      expect(logSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = logSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('POST /auth/login 200');
      expect(loggedMessage).toContain('d***@example.com');
      expect(loggedMessage).toContain('D*** J***');
      expect(loggedMessage).toContain('[REDACTED]');
      expect(loggedMessage).not.toContain('darenz@example.com');
      expect(loggedMessage).not.toContain('Darenz Jasper');
      expect(loggedMessage).not.toContain('MySecretPassword123!');
      expect(loggedMessage).not.toContain('jwt.token.value');
    });
  });
});
