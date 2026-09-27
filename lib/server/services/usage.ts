/**
 * The minute ledger — the business rule the whole pricing model rests on.
 *
 * A generation reserves its minutes up front, inside the same transaction that
 * creates the video, while holding a lock on the owner's profile row. Two tabs
 * submitting at once therefore cannot both squeeze into the last three minutes:
 * the second one waits for the first to commit, then sees the new total.
 *
 * A failed generation is refunded with a negative row, so the ledger always
 * adds up and the history shows what happened.
 */

import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db, schema, type Executor, type Tx } from "@/lib/server/db/client";
import { forbidden, paymentRequired } from "@/lib/server/http";
import type { PlanId } from "@/types";

import { currentBillingPeriod, getPlan, type BillingPeriod } from "./plans";

export async function minutesUsed(
  ownerId: string,
  period: BillingPeriod = currentBillingPeriod(),
  executor: Executor = db(),
): Promise<number> {
  const [row] = await executor
    .select({
      total: sql<number>`coalesce(sum(${schema.usageEvents.minutes}), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.ownerId, ownerId),
        gte(schema.usageEvents.createdAt, period.start),
        lt(schema.usageEvents.createdAt, period.end),
      ),
    );
  return Math.max(0, row?.total ?? 0);
}

export interface UsageSummary {
  planId: PlanId;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  maxVideoMinutes: number;
  periodStart: string;
  periodEnd: string;
}

export async function usageSummary(ownerId: string, planId: PlanId): Promise<UsageSummary> {
  const plan = getPlan(planId);
  const period = currentBillingPeriod();
  const used = await minutesUsed(ownerId, period);
  return {
    planId,
    minutesUsed: used,
    minutesLimit: plan.minutesPerMonth,
    minutesRemaining: Math.max(0, plan.minutesPerMonth - used),
    maxVideoMinutes: plan.maxDurationMinutes,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  };
}

/** Rejects a request the plan can never satisfy, before any work is done. */
export function assertWithinPlan(planId: PlanId, requestedMinutes: number) {
  const plan = getPlan(planId);
  if (requestedMinutes > plan.maxDurationMinutes) {
    throw forbidden(
      `Tu plan ${plan.name} permite videos de hasta ${plan.maxDurationMinutes} min. Sube de plan para videos más largos.`,
      "plan_duration_limit",
    );
  }
}

/**
 * Locks the owner's profile, checks the remaining quota and records the
 * charge. Must run inside a transaction — the lock is what makes it safe.
 */
export async function reserveMinutes(
  tx: Tx,
  { ownerId, videoId, minutes }: { ownerId: string; videoId: string; minutes: number },
) {
  const [profile] = await tx
    .select({ planId: schema.profiles.planId })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, ownerId))
    .for("update");

  const plan = getPlan(profile?.planId ?? "free");
  const used = await minutesUsed(ownerId, currentBillingPeriod(), tx);
  const remaining = plan.minutesPerMonth - used;

  if (minutes > remaining) {
    throw paymentRequired(
      remaining <= 0
        ? `Ya usaste tus ${plan.minutesPerMonth} minutos de este mes. Sube de plan o espera al próximo ciclo.`
        : `Te quedan ${remaining} min este mes y este video necesita ${minutes}. Elige una duración menor o sube de plan.`,
    );
  }

  await tx.insert(schema.usageEvents).values({
    ownerId,
    videoId,
    minutes,
    reason: "generation",
  });
}

/** Gives the minutes back after a generation that did not produce a video. */
export async function refundMinutes({
  ownerId,
  videoId,
  minutes,
}: {
  ownerId: string;
  videoId: string;
  minutes: number;
}) {
  await db().insert(schema.usageEvents).values({
    ownerId,
    videoId,
    minutes: -minutes,
    reason: "refund",
  });
}
