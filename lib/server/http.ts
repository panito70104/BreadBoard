/**
 * Route handler plumbing. Every API route is wrapped in `route()`, which:
 *
 * 1. Blocks cross-site writes (CSRF) before the handler runs.
 * 2. Applies the general per-minute rate limit.
 * 3. Turns thrown `HttpError`s and validation errors into `{ error, code }`
 *    responses with the right status and headers.
 */

import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/auth/session";
import { badRequest, forbidden, HttpError } from "@/lib/server/errors";
import { RATE_LIMITS, clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";

export * from "@/lib/server/errors";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Rejects state-changing requests that come from another site.
 *
 * The session cookie is `SameSite=Lax`, which already keeps it off cross-site
 * POSTs — but login is the exception: an attacker's page can POST its *own*
 * credentials to `/api/auth/login` (a plain HTML form with a text/plain body
 * shaped like JSON) and sign the victim into the attacker's account. Checking
 * where the request came from closes that, and backs up SameSite everywhere
 * else. Browsers always send these headers on cross-site requests; clients
 * that send neither (curl, server-to-server) are not browsers and carry no
 * victim's cookies.
 */
function assertSameOrigin(request: Request) {
  if (SAFE_METHODS.has(request.method)) return;

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw forbidden("Petición bloqueada: viene de otro sitio.", "cross_site_request");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // "null" or garbage: treat as foreign.
    }
    if (!host || originHost !== host) {
      throw forbidden("Petición bloqueada: viene de otro sitio.", "cross_site_request");
    }
  }
}

/**
 * General limit: per user when signed in, per IP otherwise.
 *
 * Per user because students share IPs — a university campus is often one
 * public address, and polling a generation costs ~24 requests a minute per
 * tab. Keying signed-in traffic by IP would let one classroom throttle itself.
 * Only a validly signed token counts, so the key cannot be forged.
 */
async function enforceApiLimit(request: Request) {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  const subject = session ? `user:${session.userId}` : `ip:${clientAddress(request)}`;
  enforceRateLimit(RATE_LIMITS.api, subject);
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      await enforceApiLimit(request);
      return await handler(request, context);
    } catch (cause) {
      if (cause instanceof HttpError) {
        return NextResponse.json(
          { error: cause.message, code: cause.code },
          { status: cause.status, headers: cause.headers },
        );
      }
      if (cause instanceof ZodError) {
        const first = cause.issues[0];
        return NextResponse.json(
          { error: first?.message ?? "Datos inválidos.", code: "validation_error" },
          { status: 400 },
        );
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname}`, cause);
      return NextResponse.json(
        { error: "Algo salió mal. Inténtalo de nuevo.", code: "internal_error" },
        { status: 500 },
      );
    }
  };
}

/**
 * Parses a JSON body. Requires the JSON content type: an HTML form can only
 * send form encodings or text/plain, so this also stops form-based CSRF even
 * if a browser omitted the origin headers.
 */
export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Se esperaba JSON (content-type: application/json).", "unsupported_media_type");
  }
  try {
    return await request.json();
  } catch {
    throw badRequest("El cuerpo de la petición no es JSON válido.");
  }
}
