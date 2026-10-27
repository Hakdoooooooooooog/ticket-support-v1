import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../src/common/pipes/zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const testSchema = z.object({
    username: z.string().min(3),
    age: z.number().min(18),
  });

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
