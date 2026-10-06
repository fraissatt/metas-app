import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'
import { isFunnelPublic, isPublicPath } from '@/lib/public-routes'

// Optimistic only: it sees the cookie, not whether the session is valid.
// requireUser() does the real check on the server.
export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname, isFunnelPublic())) return NextResponse.next()
  if (getSessionCookie(request)) return NextResponse.next()
  return NextResponse.redirect(new URL('/entrar', request.url))
}

export const config = {
  // Skip Next internals, the auth API, the manifest and any file with an extension (icons, images).
  matcher: ['/((?!_next/|api/auth|manifest\\.webmanifest|.*\\.[a-zA-Z0-9]+$).*)'],
}
