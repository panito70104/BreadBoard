import { getCurrentUser } from "@/lib/server/auth/dal";
import { toUserDto } from "@/lib/server/dto";
import { json, route } from "@/lib/server/http";
import { usageSummary } from "@/lib/server/services/usage";

/** The signed-in user, or `{ user: null }` — not an error, just nobody. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  return json({ user: toUserDto(user, await usageSummary(user.id, user.planId)) });
});
