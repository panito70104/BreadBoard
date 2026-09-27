import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/server/env";

import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "./session";

export async function setSessionCookie(userId: string) {
  const token = await createSessionToken(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
