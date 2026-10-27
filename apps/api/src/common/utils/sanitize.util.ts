const RAW_CRYPTO_FIELDS = new Set([
  'password',
  'passwordHash',
  'ciphertext',
  'iv',
  'accessToken',
  'attachmentCompressed',
]);

/**
 * Sanitizes a single string by stripping control characters, null bytes,
 * script/style blocks, HTML tags, dangerous URI schemes, and inline event handlers.
 */
export function sanitizeString(value: string, fieldKey?: string): string {
  if (fieldKey && RAW_CRYPTO_FIELDS.has(fieldKey)) {
    return value;
  }

  return value
    .normalize('NFC')
    // Remove ASCII control characters except tab (\x09), LF (\x0A), CR (\x0D)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove <script> and <style> blocks completely
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip dangerous URI schemes
    .replace(/\b(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, '')
    // Strip inline DOM event attributes (e.g., onerror=, onload=)
    .replace(/\bon[a-z]+\s*=/gi, '')
    .trim();
}

/**
 * Recursively sanitizes all strings within an arbitrary payload (objects, arrays, primitives)
 * while preserving Date instances and opaque cryptographic fields.
 */
export function sanitizeDeep<T>(value: T, fieldKey?: string): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value, fieldKey) as unknown as T;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item, fieldKey)) as unknown as T;
  }

  if (typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[key] = sanitizeDeep(val, key);
    }
    return sanitizedObj as T;
  }

  return value;
}
