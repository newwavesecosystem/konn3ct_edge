import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if meeting only mode is enabled
  const meetingOnlyMode = process.env.NEXT_PUBLIC_MEETING_ONLY_MODE === 'true';

  if (meetingOnlyMode) {
    const { pathname } = request.nextUrl;

    // Allow static files, api routes, Next.js internals, and public assets
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)
    ) {
      return NextResponse.next();
    }

    // Allow explicitly permitted routes
    if (
      pathname === '/post-meeting/' ||
      pathname.startsWith('/join/') ||
      pathname.startsWith('/meeting/')
    ) {
      return NextResponse.next();
    }

    // For any other route, rewrite to a 404 response
    // We rewrite to a non-existent path to trigger the default Next.js 404 page
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
