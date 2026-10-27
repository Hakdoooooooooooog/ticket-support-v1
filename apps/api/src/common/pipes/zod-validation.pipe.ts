import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const formattedErrors = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return result.data;
  }
}
