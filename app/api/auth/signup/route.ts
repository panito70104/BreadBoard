import { setSessionCookie } from "@/lib/server/auth/cookies";
import { toUserDto } from "@/lib/server/dto";
import { json, readJson, route } from "@/lib/server/http";
import { RATE_LIMITS, clientAddress, enforceRateLimit } from "@/lib/server/rate-limit";
import { signup } from "@/lib/server/services/accounts";
import { usageSummary } from "@/lib/server/services/usage";

export const POST = route(async (request) => {
  enforceRateLimit(RATE_LIMITS.signup, clientAddress(request));

  const user = await signup(await readJson(request));
  await setSessionCookie(user.id);

  return json({ user: toUserDto(user, await usageSummary(user.id, user.planId)) }, { status: 201 });
});
