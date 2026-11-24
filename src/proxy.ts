import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: send visitors without a session cookie to /login.
 * Real verification (signature, expiry, active account, role) happens server-side
 * in the (app) layout and in every API route.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get("impano_projects_session")?.value) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/users/:path*", "/activity/:path*", "/account/:path*"],
};
