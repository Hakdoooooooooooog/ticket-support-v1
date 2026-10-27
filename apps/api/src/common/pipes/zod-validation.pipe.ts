import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

export function isZodDto(metatype: unknown): metatype is { isZodDto: true; schema: ZodType } {
  return Boolean(
    metatype &&
      (typeof metatype === 'object' || typeof metatype === 'function') &&
      'isZodDto' in metatype &&
      (metatype as { isZodDto?: boolean }).isZodDto === true &&
      'schema' in metatype,
  );
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodType) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    if (this.schema && metadata?.type && metadata.type !== 'body') {
      return value;
    }

    const targetSchema: ZodType | undefined =
      this.schema ??
      (metadata?.metatype && isZodDto(metadata.metatype)
        ? metadata.metatype.schema
        : undefined);

    if (!targetSchema) {
      return value;
    }

    const result = targetSchema.safeParse(value);

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


