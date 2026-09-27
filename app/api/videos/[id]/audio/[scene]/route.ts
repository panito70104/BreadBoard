import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth/dal";
import { notFound } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { getOwnedVideoRow } from "@/lib/server/services/videos";
import { signedReadUrl } from "@/lib/server/storage";

/**
 * The voice-over for one scene.
 *
 * Redirects to a signed URL after checking ownership, like every other read out
 * of a bucket. The player points `<Audio>` straight at this path, so the URL in
 * the storyboard never has to be signed ahead of time or kept fresh.
 */
export const GET = route<RouteContext<"/api/videos/[id]/audio/[scene]">>(
  async (_request, { params }) => {
    const user = await requireUser();
    const { id, scene: sceneId } = await params;

    const { video } = await getOwnedVideoRow(user.id, id);
    const scene = video.storyboard?.scenes.find((entry) => entry.id === sceneId);
    if (!scene?.audio) throw notFound("Esa escena no tiene voz.");

    const url = await signedReadUrl("videos", scene.audio.key);
    return NextResponse.redirect(url, { status: 302 });
  },
);
