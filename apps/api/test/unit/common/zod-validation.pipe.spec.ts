import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe.js';

const testSchema = z.object({
  username: z.string().min(3),
  age: z.number().min(18),
});

class SampleZodDto extends createZodDto(testSchema) {}

describe('ZodValidationPipe', () => {
  describe('with explicit schema passed to constructor', () => {
    const pipe = new ZodValidationPipe(testSchema);

    it('should parse and return valid payload', () => {
      const input = { username: 'alex', age: 25 };
      const result = pipe.transform(input, {} as any);
      expect(result).toEqual(input);
    });

    it('should throw BadRequestException on invalid input with structured field errors', () => {
      const invalidInput = { username: 'al', age: 15 };

      try {
        pipe.transform(invalidInput, {} as any);
        expect.fail('Should have thrown BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = (err as BadRequestException).getResponse() as any;
        expect(response.statusCode).toBe(400);
        expect(response.errors).toHaveLength(2);
        expect(response.errors[0].field).toBe('username');
        expect(response.errors[1].field).toBe('age');
      }
    });
  });

  describe('with automatic createZodDto metatype resolution', () => {
    const pipe = new ZodValidationPipe();

    it('should resolve and validate against DTO schema from argument metadata', () => {
      const validPayload = { username: 'darenz', age: 22 };
      const result = pipe.transform(validPayload, {
        type: 'body',
        metatype: SampleZodDto,
      });

      expect(result).toEqual(validPayload);
    });

    it('should throw BadRequestException when payload fails DTO validation', () => {
      const invalidPayload = { username: 'd', age: 12 };

      expect(() =>
        pipe.transform(invalidPayload, {
          type: 'body',
          metatype: SampleZodDto,
        }),
      ).toThrow(BadRequestException);
    });

    it('should pass value through untouched when metadata is not a ZodDto', () => {
      const value = 'raw-string';
      const result = pipe.transform(value, {
        type: 'param',
        metatype: String,
      });

      expect(result).toBe('raw-string');
    });
  });
});
