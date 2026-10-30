import { describe, it, expect, afterEach } from 'vitest';

import { DemoAccountsBar } from '../src/components/auth/demo-accounts-bar';
import { isValidElement } from 'react';

describe('Demo Accounts Production Security Guard', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('strictly returns null and renders nothing when NODE_ENV is production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const element = DemoAccountsBar({ onSelectAccount: () => {} });
    expect(element).toBeNull();
  });

  it('renders demo account options when in development mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const element = DemoAccountsBar({ onSelectAccount: () => {} });
    expect(element).not.toBeNull();
    expect( isValidElement(element)).toBe(true);
  });
});
