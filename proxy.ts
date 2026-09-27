/**
 * Optimistic route protection.
 *
 * Runs before every matched page and only reads the session cookie — no
 * database — so redirects stay instant, including on prefetches. It is not
 * the security boundary: every route handler and the app layout re-check the
 * user against the database. This just keeps signed-out visitors from seeing
 * an app shell flash before being bounced.
 *
 * API routes are deliberately excluded: they answer 401 JSON on their own,
 * which is what a fetch expects. Redirecting an API call to /login would hand
 * the client an HTML page it cannot parse.
 */

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/auth/session";

const APP_ROUTES = ["/dashboard", "/videos", "/billing", "/settings"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

function isUnder(pathname: string, roots: string[]) {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && isUnder(pathname, APP_ROUTES)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (session && isUnder(pathname, AUTH_ROUTES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/videos/:path*",
    "/billing/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
