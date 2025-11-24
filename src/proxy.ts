import { NextResponse } from 'next/server';

export function proxy(request: Request) {
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASS;

  // Require credentials to be configured; if missing, block access.
  if (!username || !password) {
    return unauthorized();
  }

  const auth = request.headers.get('authorization');
  const { pathname } = new URL(request.url);
  // Allow common static assets to bypass without matching on complex regex
  const allowPrefixes = ['/_next/static', '/_next/image', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/assets/'];
  const allowExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js'];
  if (allowPrefixes.some((prefix) => pathname.startsWith(prefix)) || allowExtensions.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }
  if (!auth || !auth.toLowerCase().startsWith('basic ')) {
    return unauthorized();
  }

  const base64 = auth.split(' ')[1];
  try {
    const decoded = atob(base64 || '');
    const [user, pass] = decoded.split(':');
    if (user === username && pass === password) {
      return NextResponse.next();
    }
  } catch {
    // fall through to unauthorized
  }

  return unauthorized();
}

function unauthorized() {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Protected"' },
  });
}

export const config = {
  matcher: ['/:path*'],
};
