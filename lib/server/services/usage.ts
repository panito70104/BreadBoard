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
 *
 * Minutes are not the only meter. Every generation costs a model call and a
 * voice call whatever it produces, so a plan metered only in minutes can be
 * spent one short video at a time — thirty one-minute videos cost far more to
 * serve than ten three-minute ones for the same thirty minutes. Paid plans are
 * priced with that headroom; the free one is not, so its generations are
 * counted too.
 */

import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db, schema, type Executor, type Tx } from "@/lib/server/db/client";
import { paymentRequired } from "@/lib/server/http";
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

/** Generations started this period. Restarts count: each one costs again. */
export async function generationsUsed(
  ownerId: string,
  period: BillingPeriod = currentBillingPeriod(),
  executor: Executor = db(),
): Promise<number> {
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.ownerId, ownerId),
        eq(schema.usageEvents.reason, "generation"),
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
  /** Null on the plans that only meter minutes. */
  videosLimit: number | null;
  videosUsed: number;
  videosRemaining: number | null;
  periodStart: string;
  periodEnd: string;
}

export async function usageSummary(ownerId: string, planId: PlanId): Promise<UsageSummary> {
  const plan = getPlan(planId);
  const period = currentBillingPeriod();
  const [used, videos] = await Promise.all([
    minutesUsed(ownerId, period),
    plan.videosPerMonth === null ? Promise.resolve(0) : generationsUsed(ownerId, period),
  ]);

  return {
    planId,
    minutesUsed: used,
    minutesLimit: plan.minutesPerMonth,
    minutesRemaining: Math.max(0, plan.minutesPerMonth - used),
    maxVideoMinutes: plan.maxDurationMinutes,
    videosLimit: plan.videosPerMonth,
    videosUsed: videos,
    videosRemaining:
      plan.videosPerMonth === null ? null : Math.max(0, plan.videosPerMonth - videos),
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  };
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
  const period = currentBillingPeriod();

  if (plan.videosPerMonth !== null) {
    const videos = await generationsUsed(ownerId, period, tx);
    if (videos >= plan.videosPerMonth) {
      throw paymentRequired(
        plan.videosPerMonth === 1
          ? `El plan ${plan.name} incluye un video al mes y ya lo usaste. Sube de plan para seguir generando.`
          : `Ya generaste los ${plan.videosPerMonth} videos que incluye el plan ${plan.name} este mes.`,
      );
    }
  }

  const used = await minutesUsed(ownerId, period, tx);
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

/**
 * Squares the reservation with the video that came out.
 *
 * A generation has to hold minutes before it starts — that hold is the only
 * thing stopping two tabs spending the same last minutes — but how long the
 * video turns out to be is not known until the model has written it and the
 * voice has read it. So the hold is the most the request could have cost, and
 * this gives back the difference.
 *
 * Written as its own signed row rather than by editing the reservation, so the
 * ledger stays append-only and the history still shows what was held and when.
 */
export async function settleMinutes({
  ownerId,
  videoId,
  reserved,
  actual,
}: {
  ownerId: string;
  videoId: string;
  reserved: number;
  actual: number;
}) {
  // Never more than was held. The student was told what the video could cost
  // before it started, and a second `generation` row would also make this look
  // like a second generation to the counter above.
  const charged = Math.min(reserved, actual);
  if (charged >= reserved) return;

  await db().insert(schema.usageEvents).values({
    ownerId,
    videoId,
    minutes: charged - reserved,
    reason: "refund",
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
