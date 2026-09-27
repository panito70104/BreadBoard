import { after } from "next/server";

import { requireUser } from "@/lib/server/auth/dal";
import { json, route } from "@/lib/server/http";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/server/rate-limit";
import { restartGeneration, runGeneration } from "@/lib/server/services/generation";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route<RouteContext<"/api/videos/[id]/regenerate">>(
  async (_request, { params }) => {
    const user = await requireUser();
    enforceRateLimit(RATE_LIMITS.generation, user.id);
    const { id } = await params;
    const video = await restartGeneration(user, id);
    after(() => runGeneration(video.id));
    return json({ video }, { status: 202 });
  },
);
