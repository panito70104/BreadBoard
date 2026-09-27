/** Shapes the API returns, built from server types. */

import "server-only";

import type { AuthUser } from "@/lib/server/auth/dal";
import type { UsageSummary } from "@/lib/server/services/usage";
import type { User } from "@/types";

export function toUserDto(user: AuthUser, usage: UsageSummary): User & {
  usage: UsageSummary;
} {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    planId: user.planId,
    createdAt: user.createdAt.toISOString(),
    minutesUsed: usage.minutesUsed,
    minutesLimit: usage.minutesLimit,
    usage,
    preferences: user.preferences,
  };
}
