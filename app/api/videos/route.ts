import { after } from "next/server";

import { requireUser } from "@/lib/server/auth/dal";
import { json, route } from "@/lib/server/http";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/server/rate-limit";
import {
  reapStaleGenerations,
  runGeneration,
  startGeneration,
} from "@/lib/server/services/generation";
import { listVideos } from "@/lib/server/services/videos";

// PDF/DOCX parsing needs Node, and the background half calls Claude, which can
// think for a couple of minutes on a long chapter.
export const runtime = "nodejs";
export const maxDuration = 300;

export const GET = route(async () => {
  const user = await requireUser();
  await reapStaleGenerations(user.id);
  return json({ videos: await listVideos(user.id) });
});

/** Multipart: `file`, `style`, `durationMinutes`, optional `prompt`. */
export const POST = route(async (request) => {
  const user = await requireUser();
  enforceRateLimit(RATE_LIMITS.generation, user.id);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "No pudimos leer el archivo enviado.", code: "bad_request" }, { status: 400 });
  }

  const video = await startGeneration(user, form);

  // Respond now; the slow part runs after the response is sent.
  after(() => runGeneration(video.id));

  return json({ video }, { status: 202 });
});
