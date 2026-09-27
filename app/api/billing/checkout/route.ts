import { requireUser } from "@/lib/server/auth/dal";
import { json, readJson, route } from "@/lib/server/http";
import { changePlan } from "@/lib/server/services/accounts";

/**
 * Mock checkout: switches the plan immediately.
 *
 * TODO(payments): create a Recurrente checkout here and return its URL.
 * The plan must only change from Recurrente's webhook, once payment is
 * confirmed — never from this endpoint, which the client controls.
 */
export const POST = route(async (request) => {
  const user = await requireUser();
  const body = (await readJson(request)) as { planId?: unknown };
  const profile = await changePlan(user.id, body?.planId);
  return json({ planId: profile.planId, checkoutUrl: null });
});
