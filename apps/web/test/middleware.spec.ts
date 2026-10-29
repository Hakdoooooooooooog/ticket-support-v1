import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy as middleware } from '../src/proxy';

describe('Next.js Edge Middleware', () => {
  it('allows unauthenticated visitors to view the landing and login page (/)', () => {
    const req = new NextRequest('http://localhost:3000/');
    const res = middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('redirects unauthenticated users trying to access /admin directly to / with redirect query', () => {
    const req = new NextRequest('http://localhost:3000/admin');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('http://localhost:3000/?redirect=%2Fadmin');
  });

  it('redirects unauthenticated users trying to access /portal directly to / with redirect query', () => {
    const req = new NextRequest('http://localhost:3000/portal');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('http://localhost:3000/?redirect=%2Fportal');
  });

  it('allows authenticated users possessing the httpOnly rt cookie to enter /admin', () => {
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: {
        cookie: 'rt=valid_refresh_token_jwt',
      },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('allows authenticated users possessing the httpOnly rt cookie to enter /portal', () => {
    const req = new NextRequest('http://localhost:3000/portal', {
      headers: {
        cookie: 'rt=valid_refresh_token_jwt',
      },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
