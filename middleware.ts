import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/buyer-request-webhook' || pathname === '/login') {
    return NextResponse.next();
  }
  const token = request.cookies.get('admin-token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/buyer-request-webhook|login|_next).*)'],
};
