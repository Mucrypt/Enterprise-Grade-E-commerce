import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_ROLE_COOKIE_NAME,
  DASHBOARD_ACCESS_MARKERS,
} from '@/lib/admin-role-cookie'

// Server-side gate on the dashboard shell itself. Runs before any page
// component renders, so a session without an admin/super_admin role cookie
// never receives the dashboard HTML at all -- previously the only check was
// client-side in app/(dashboard)/layout.tsx, which renders children first
// and redirects in a useEffect afterwards, and only verified that *some*
// token existed, not its role.
//
// This is a coarse, defense-in-depth gate, not the authorization boundary.
// The cookie is a plain (non-HttpOnly) value the client sets at login/
// session-load time from AuthContext -- see lib/admin-role-cookie.ts for
// why, and docs/LAUNCH-FOUNDATION-1-REPORT.md for the fuller server-verified
// (HttpOnly session cookie) design proposed as a follow-up. Every actual
// privileged action still requires a valid JWT checked by the API's
// authenticate/authorize middleware -- this file only prevents the
// dashboard shell from rendering for a session that plainly isn't staff.

const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const role = request.cookies.get(ADMIN_ROLE_COOKIE_NAME)?.value

  if (!role || !DASHBOARD_ACCESS_MARKERS.includes(role)) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
