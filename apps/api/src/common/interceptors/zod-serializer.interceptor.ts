import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ZodType } from 'zod';
import { ZOD_SERIALIZER_SCHEMA_KEY } from '../decorators/zod-serializer.decorator.js';
import { sanitizeDeep } from '../utils/sanitize.util.js';

@Injectable()
export class ZodSerializerInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const schema = this.reflector.getAllAndOverride<ZodType | undefined>(
      ZOD_SERIALIZER_SCHEMA_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        if (data === null || data === undefined) {
          return data;
        }

        const sanitizedData = sanitizeDeep(data);

        if (!schema) {
          return sanitizedData;
        }

        // If response is an array of items (e.g. findAll)
        if (Array.isArray(sanitizedData)) {
          return sanitizedData.map((item) => sanitizeDeep(schema.parse(item)));
        }

        // If response is a single entity
        return sanitizeDeep(schema.parse(sanitizedData));
      }),
    );
  }
}
