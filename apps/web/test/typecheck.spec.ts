import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('TypeScript Type Integrity Check', () => {
  it('passes strict tsc compiler validation without any type or reference errors', () => {
    const webRoot = path.resolve(__dirname, '..');
    const result = execSync('npx tsc --noEmit', {
      cwd: webRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    expect(result.trim()).toBe('');
  }, 20000);
});
