/**
 * Data Access Layer for identity — the one place that decides who is calling.
 *
 * `proxy.ts` only does an optimistic check (is there a valid token?) so pages
 * redirect quickly. Real authorization happens here, against the database,
 * on every request that touches data. Both are cached per request with
 * React's `cache`, so calling them from several places costs one query.
 */

import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { db, schema } from "@/lib/server/db/client";
import { unauthorized } from "@/lib/server/http";
import type { PlanId, UserPreferences, VideoDurationMinutes, VideoStyle } from "@/types";

import { SESSION_COOKIE, verifySessionToken } from "./session";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  planId: PlanId;
  createdAt: Date;
  preferences: UserPreferences;
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db()
    .select({
      id: schema.profiles.id,
      email: schema.users.email,
      name: schema.profiles.name,
      planId: schema.profiles.planId,
      createdAt: schema.profiles.createdAt,
      defaultStyle: schema.profiles.defaultStyle,
      defaultDurationMinutes: schema.profiles.defaultDurationMinutes,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.id))
    .where(eq(schema.profiles.id, session.userId))
    .limit(1);

  // A valid token for a deleted account is still no account.
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    planId: row.planId as PlanId,
    createdAt: row.createdAt,
    preferences: {
      defaultStyle: row.defaultStyle as VideoStyle,
      defaultDurationMinutes: row.defaultDurationMinutes as VideoDurationMinutes,
    },
  };
});

/** For route handlers: the caller, or a 401. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}
