/**
 * Session tokens.
 *
 * A signed JWT in an httpOnly cookie. It carries only the user id: anything
 * that can change (name, plan) is read from the database on each request, so
 * a stale token never shows a stale plan.
 *
 * This module is deliberately dependency-light — just `jose` and one env var —
 * because `proxy.ts` runs it on every navigation and must not pull in the
 * database client.
 *
 * On Supabase this whole file goes away: Supabase Auth issues and verifies the
 * token, and `sub` stays the user id, so callers of `verifySessionToken` keep
 * the same shape.
 */

import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "bb_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  userId: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET falta o es demasiado corto (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("breadboard")
    .setAudience("breadboard-app")
    .sign(secretKey());
}

/** Returns the session, or null for anything missing, expired or tampered. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: "breadboard",
      audience: "breadboard-app",
    });
    return typeof payload.sub === "string" ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
