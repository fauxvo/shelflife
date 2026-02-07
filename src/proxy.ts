import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/api/auth/plex/pin", "/api/auth/plex/callback", "/api/health"];

const isDebug =
  process.env.DEBUG === "true" || process.env.DEBUG === "1" || process.env.DEBUG === "*";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    if (isDebug) console.log(`[DEBUG:middleware] ALLOW public path: ${pathname}`);
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.\w+$/)
  ) {
    return NextResponse.next();
  }

  // Check for session cookie (JWT validation happens in the route handlers)
  const session = request.cookies.get("shelflife-session");
  if (!session?.value) {
    if (isDebug) console.log(`[DEBUG:middleware] BLOCK no session: ${pathname}`);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isDebug) console.log(`[DEBUG:middleware] ALLOW authenticated: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
