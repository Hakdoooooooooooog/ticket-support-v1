import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

const SECRET_KEYS =
  /^(password|passwordhash|accesstoken|refreshtoken|token|authorization|cookie|secret|apikey|ssn|creditcard)$/i;
const EMAIL_KEYS = /^(email|useremail|creatormail)$/i;
const NAME_KEYS = /^(fullname|name|firstname|lastname|phone|phonenumber|address|ip)$/i;

const INLINE_EMAIL_REGEX = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const INLINE_BEARER_REGEX =
  /\bBearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/gi;
const INLINE_PHONE_REGEX =
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '[REDACTED_EMAIL]';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}

export function maskName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '[REDACTED_PII]';
  return trimmed
    .split(/\s+/)
    .map((part) => (part.length > 0 ? `${part[0]}***` : ''))
    .join(' ');
}

export function scrubInlinePii(text: string): string {
  return text
    .replace(INLINE_BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(INLINE_EMAIL_REGEX, (_match, local: string, domain: string) => {
      return `${local[0]}***@${domain}`;
    })
    .replace(INLINE_PHONE_REGEX, '[REDACTED_PHONE]');
}

/**
 * Recursively clones and redacts PII (emails, names, phones, passwords, tokens)
 * from any payload before it is logged or inspected.
 */
export function redactPii(input: unknown, seen = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return scrubInlinePii(input);
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (seen.has(input)) {
    return '[Circular]';
  }
  seen.add(input);

  if (Array.isArray(input)) {
    return input.map((item) => redactPii(item, seen));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEYS.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (EMAIL_KEYS.test(key) && typeof value === 'string') {
      redacted[key] = maskEmail(value);
    } else if (NAME_KEYS.test(key) && typeof value === 'string') {
      redacted[key] = maskName(value);
    } else {
      redacted[key] = redactPii(value, seen);
    }
  }

  return redacted;
}

@Injectable()
export class PiiRedactingLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      body?: unknown;
      query?: unknown;
    }>();
    const res = http.getResponse<{ statusCode?: number }>();

    const method = req.method || 'UNKNOWN';
    const rawUrl = req.originalUrl || req.url || '/';
    const safeUrl = scrubInlinePii(rawUrl);
    const safeBody =
      req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
        ? JSON.stringify(redactPii(req.body))
        : undefined;

    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseData) => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode ?? 200;
        const safeResponsePreview = this.summarizeResponse(responseData);

        const parts = [`${method} ${safeUrl} ${statusCode} - ${duration}ms`];
        if (safeBody) parts.push(`req=${safeBody}`);
        if (safeResponsePreview) parts.push(`res=${safeResponsePreview}`);

        this.logger.log(parts.join(' | '));
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        const statusCode = err?.status ?? err?.statusCode ?? 500;
        const parts = [`${method} ${safeUrl} ${statusCode} - ${duration}ms`];
        if (safeBody) parts.push(`req=${safeBody}`);
        this.logger.warn(parts.join(' | '));
        throw err;
      }),
    );
  }

  protected summarizeResponse(data: unknown): string | undefined {
    if (data === undefined || data === null) return undefined;
    if (Array.isArray(data)) {
      return `[Array(${data.length})]`;
    }
    if (typeof data === 'object') {
      return JSON.stringify(redactPii(data));
    }
    return String(scrubInlinePii(String(data)));
  }
}
