import { setSessionCookie } from "@/lib/server/auth/cookies";
import { toUserDto } from "@/lib/server/dto";
import { HttpError, json, readJson, route } from "@/lib/server/http";
import {
  RATE_LIMITS,
  clientAddress,
  enforceRateLimit,
  releaseRateLimitHit,
} from "@/lib/server/rate-limit";
import { login } from "@/lib/server/services/accounts";
import { usageSummary } from "@/lib/server/services/usage";

/**
 * Only failed logins count against the IP: 10 wrong passwords in 30 minutes
 * and that address waits. Successful logins, malformed requests and server
 * errors give their slot back.
 *
 * Two properties this keeps on purpose:
 * - The slot is taken *before* checking the password, so a burst of parallel
 *   guesses cannot all slip in while bcrypt runs.
 * - A success returns only its own slot and never clears earlier failures —
 *   otherwise an attacker with one valid account could log into it between
 *   guesses and never be blocked.
 */
export const POST = route(async (request) => {
  const ip = clientAddress(request);
  const slot = enforceRateLimit(RATE_LIMITS.login, ip);

  try {
    const user = await login(await readJson(request));
    releaseRateLimitHit(RATE_LIMITS.login, ip, slot);
    await setSessionCookie(user.id);
    return json({ user: toUserDto(user, await usageSummary(user.id, user.planId)) });
  } catch (error) {
    const wrongCredentials = error instanceof HttpError && error.status === 401;
    if (!wrongCredentials) releaseRateLimitHit(RATE_LIMITS.login, ip, slot);
    throw error;
  }
});
