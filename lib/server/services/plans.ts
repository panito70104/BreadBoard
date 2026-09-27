/**
 * Plan catalogue and billing periods.
 *
 * Plans are code, not rows: they change with a deploy, never at runtime, and
 * keeping them next to the pricing page means the two cannot disagree.
 */

import "server-only";

import { mockPlans } from "@/data/mock";
import { forbidden } from "@/lib/server/http";
import type { PlanId, SubscriptionPlan } from "@/types";

export function listPlans(): SubscriptionPlan[] {
  return mockPlans;
}

export function getPlan(planId: string): SubscriptionPlan {
  const plan = mockPlans.find((candidate) => candidate.id === planId);
  if (!plan) throw forbidden(`El plan "${planId}" no existe.`, "unknown_plan");
  return plan;
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && mockPlans.some((plan) => plan.id === value);
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * The current calendar month in UTC. Quotas reset on the 1st.
 * TODO(payments): switch to the subscription's own anchor date once Recurrente
 * owns billing, so a plan bought on the 17th renews on the 17th.
 */
export function currentBillingPeriod(now: Date = new Date()): BillingPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
