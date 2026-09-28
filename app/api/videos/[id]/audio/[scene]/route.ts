import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/auth/dal";
import { notFound } from "@/lib/server/errors";
import { route } from "@/lib/server/http";
import { getOwnedVideoRow } from "@/lib/server/services/videos";
import { RangeNotSatisfiable, getObjectRange } from "@/lib/server/storage";

/**
 * The voice-over for one scene, streamed.
 *
 * This used to redirect to a signed URL, which is how every other read out of a
 * bucket works and is wrong for media. A player does not fetch audio once: it
 * seeks, and every seek is a byte-range request. Against a redirect each of
 * those lands back here and leaves with a *different* signed URL, so the
 * browser cannot cache or reuse anything and re-fetches constantly.
 *
 * That matters more than it sounds. Remotion keeps the audio element in step
 * with the composition's clock and, when it drifts more than 0.65s behind,
 * seeks it back to catch up — which replays the second before, and you hear the
 * last word of the sentence twice. A source that stalls is therefore not a
 * buffering annoyance; it is an audible stutter.
 *
 * So the bytes come through here, from one stable URL, with range support and
 * a cache header. The `v` in the URL changes when the audio does, which is what
 * makes caching safe across a regeneration.
 *
 * The range is answered by storage rather than by slicing a full download —
 * see `getObjectRange`. Fetching the whole mp3 to hand back four kilobytes of
 * it is the same stall by another route, and it also held the entire file in
 * this process's memory once per request.
 */
export const GET = route<RouteContext<"/api/videos/[id]/audio/[scene]">>(
  async (request, { params }) => {
    const user = await requireUser();
    const { id, scene: sceneId } = await params;

    const { video } = await getOwnedVideoRow(user.id, id);
    const scene = video.storyboard?.scenes.find((entry) => entry.id === sceneId);
    if (!scene?.audio) throw notFound("Esa escena no tiene voz.");

    let slice;
    try {
      slice = await getObjectRange("videos", scene.audio.key, request.headers.get("range"));
    } catch (cause) {
      if (cause instanceof RangeNotSatisfiable) {
        return new NextResponse(null, {
          status: 416,
          headers: { "content-range": `bytes */${cause.total ?? 0}` },
        });
      }
      throw cause;
    }

    const headers = new Headers({
      "content-type": "audio/mpeg",
      "accept-ranges": "bytes",
      "content-length": String(slice.bytes.byteLength),
      // Private: the URL is only reachable by the owner anyway, and the browser
      // needs to keep it to seek without going back to the network.
      "cache-control": "private, max-age=600",
      etag: `"${scene.audio.key}-${scene.audio.durationSeconds}"`,
    });

    if (!slice.partial) {
      return new NextResponse(slice.bytes as BodyInit, { status: 200, headers });
    }

    headers.set("content-range", `bytes ${slice.start}-${slice.end}/${slice.total}`);
    return new NextResponse(slice.bytes as BodyInit, { status: 206, headers });
  },
);
