import { clearSessionCookie } from "@/lib/server/auth/cookies";
import { json, route } from "@/lib/server/http";

export const POST = route(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
