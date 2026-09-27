/**
 * Rate limiting: sliding window, in process memory.
 *
 * Sliding rather than fixed: a fixed 30-minute window lets an attacker spend
 * 10 attempts at minute 29 and 10 more at minute 31 — 20 in two minutes. Here
 * every request looks back exactly one window, so "10 in 30 minutes" holds for
 * any 30 minutes you pick.
 *
 * Limits live in one place (`RATE_LIMITS`) so they can be read and tuned
 * together. Rejected requests are not recorded: waiting it out always works.
 *
 * Scope: one process. Deployed to several instances (serverless included),
 * each keeps its own counts — move the store to Postgres or Redis then. After
 * the Supabase migration, the login and signup limits are Supabase Auth's job.
 */

import "server-only";

import { tooManyRequests } from "@/lib/server/errors";

export interface RateLimitRule {
  id: string;
  limit: number;
  windowMs: number;
  /** What is being counted, for the 429 message ("intentos fallidos"). */
  label?: string;
}

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /**
   * Failed login attempts per IP. Only wrong credentials count: a campus
   * behind one public IP must not lock itself out just by students signing in.
   */
  login: { id: "login", limit: 10, windowMs: 30 * MINUTE, label: "intentos fallidos" },
  /** Accounts created per IP. */
  signup: { id: "signup", limit: 5, windowMs: 60 * MINUTE },
  /** Generations started per user — each can call Claude. */
  generation: { id: "generation", limit: 10, windowMs: 10 * MINUTE },
  /** Every API request, per signed-in user or, if signed out, per IP. */
  api: { id: "api", limit: 300, windowMs: MINUTE },
} satisfies Record<string, RateLimitRule>;

interface Entry {
  windowMs: number;
  /** Timestamps of accepted requests, oldest first. */
  hits: number[];
}

// On globalThis so every route bundle shares one store — Next may evaluate
// this module more than once, and split counters would each allow the limit.
const globalStore = globalThis as unknown as {
  breadboardRateLimit?: { entries: Map<string, Entry>; calls: number };
};
const store = (globalStore.breadboardRateLimit ??= { entries: new Map(), calls: 0 });

/** Drops keys whose newest hit left the window, so memory stays bounded. */
function prune(now: number) {
  for (const [key, entry] of store.entries) {
    const newest = entry.hits[entry.hits.length - 1] ?? 0;
    if (newest <= now - entry.windowMs) store.entries.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  /** Timestamp of the hit this call recorded, to release it later. */
  at: number;
}

export function checkRateLimit(
  rule: RateLimitRule,
  subject: string,
  now: number = Date.now(),
): RateLimitResult {
  store.calls += 1;
  if (store.calls % 1000 === 0) prune(now);

  const key = `${rule.id}:${subject}`;
  const entry: Entry = store.entries.get(key) ?? { windowMs: rule.windowMs, hits: [] };
  entry.hits = entry.hits.filter((time) => time > now - rule.windowMs);
  store.entries.set(key, entry);

  if (entry.hits.length >= rule.limit) {
    // The slot frees up when the oldest counted request leaves the window.
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.hits[0] + rule.windowMs - now,
      at: now,
    };
  }

  entry.hits.push(now);
  return { allowed: true, remaining: rule.limit - entry.hits.length, retryAfterMs: 0, at: now };
}

/**
 * Throws a 429 (with `Retry-After`) when the subject is over the limit.
 * Otherwise records the hit and returns its timestamp, which
 * `releaseRateLimitHit` can take back.
 */
export function enforceRateLimit(rule: RateLimitRule, subject: string): number {
  const result = checkRateLimit(rule, subject);
  if (!result.allowed) throw tooManyRequests(result.retryAfterMs, rule.label);
  return result.at;
}

/**
 * Un-counts one recorded hit — for limits that should only count some
 * outcomes, such as failed logins.
 *
 * Record first, release later, rather than "check, then record on failure":
 * the check-then-record version lets a burst of parallel requests all pass the
 * check before any failure is recorded. Recording up front is synchronous, so
 * at most `limit` attempts can ever be in flight.
 */
export function releaseRateLimitHit(rule: RateLimitRule, subject: string, at: number) {
  const entry = store.entries.get(`${rule.id}:${subject}`);
  if (!entry) return;
  const index = entry.hits.indexOf(at);
  if (index !== -1) entry.hits.splice(index, 1);
}

/**
 * The caller's IP, taken from the **last** `X-Forwarded-For` entry.
 *
 * The first entry is whatever the client wrote, so trusting it lets anyone
 * pick a new IP per request and walk past every limit. The last entry is the
 * one your own proxy appended. Vercel overwrites the header outright and
 * nginx's `$proxy_add_x_forwarded_for` appends, so both are covered.
 *
 * Without a proxy in front (local development), there is nothing trustworthy
 * to read: the app must be deployed behind one.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
