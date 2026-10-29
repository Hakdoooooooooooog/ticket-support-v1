import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Edge Middleware
 * 1. Protects private application routes (/admin, /portal) on the server/edge level.
 * 2. Injects enterprise-grade security headers across all matched routes.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Edge-Level Route Guarding
  const isProtectedPath = pathname.startsWith('/admin') || pathname.startsWith('/portal');

  if (isProtectedPath) {
    const hasRefreshToken = request.cookies.has('rt');
    if (!hasRefreshToken) {
      const loginUrl = new URL('/', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Attach Edge Security Headers
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  );

  return response;
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api routes
     * 2. /_next/static (static build artifacts)
     * 3. /_next/image (image optimization cache)
     * 4. /favicon.ico, /robots.txt, /sitemap.xml (static public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
