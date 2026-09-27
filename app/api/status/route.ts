import { requireUser } from "@/lib/server/auth/dal";
import { json, route } from "@/lib/server/http";
import { resolveProvider } from "@/lib/server/services/storyboard-provider";
import type { ServiceStatus } from "@/types";

/**
 * What the server can do right now, so the UI can say so before the student
 * spends minutes. Never reveals keys — only whether Claude is wired up.
 */
export const GET = route(async () => {
  await requireUser();
  const status: ServiceStatus = { storyboardProvider: resolveProvider() };
  return json(status);
});
