/**
 * Videos: listing, reading, deleting, and the shape the client receives.
 *
 * Every query here filters by owner. A video that exists but belongs to
 * someone else is reported as not found, never as forbidden — otherwise ids
 * could be probed to learn what exists.
 */

import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/server/db/client";
import type { DocumentRow, VideoRow } from "@/lib/server/db/schema";
import { notFound } from "@/lib/server/http";
import { isUuid } from "@/lib/server/ids";
import type { GenerationStage, Video } from "@/types";

import { deleteObject } from "@/lib/server/storage";

import { deleteDocument, toDocumentDto } from "./documents";

const STAGE_PROGRESS: Record<GenerationStage, number> = {
  queued: 8,
  reading: 30,
  storyboarding: 52,
  voicing: 76,
  finalizing: 92,
  done: 100,
};

/** A generation that has not moved in this long is treated as dead. */
export const STALE_GENERATION_MS = 10 * 60 * 1000;

const MISSING_DOCUMENT = {
  id: "",
  name: "Documento eliminado",
  type: "pdf",
  sizeBytes: 0,
  uploadedAt: new Date(0).toISOString(),
} as const;

export function toVideoDto(row: VideoRow, document: DocumentRow | null): Video {
  const stage = row.stage as GenerationStage;
  return {
    id: row.id,
    title: row.title,
    status: row.status as Video["status"],
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.durationSeconds,
    style: row.style as Video["style"],
    sourceDocument: document ? toDocumentDto(document) : { ...MISSING_DOCUMENT },
    storyboard: row.storyboard?.scenes ?? [],
    audioUrls: Object.fromEntries(
      (row.storyboard?.scenes ?? [])
        .filter((scene) => scene.audio)
        .map((scene) => [scene.id, `/api/videos/${row.id}/audio/${scene.id}`]),
    ),
    prompt: row.prompt ?? undefined,
    error: row.error ?? undefined,
    stage,
    progress: row.status === "generating" ? STAGE_PROGRESS[stage] : undefined,
    requestedMinutes: row.requestedMinutes,
    source: row.source as Video["source"],
    language: row.storyboard?.language,
    notice: row.notice ?? undefined,
  };
}

export async function listVideos(ownerId: string): Promise<Video[]> {
  const rows = await db()
    .select({ video: schema.videos, document: schema.documents })
    .from(schema.videos)
    .leftJoin(schema.documents, eq(schema.documents.id, schema.videos.documentId))
    .where(eq(schema.videos.ownerId, ownerId))
    .orderBy(desc(schema.videos.createdAt))
    .limit(200);

  return rows.map(({ video, document }) => toVideoDto(video, document));
}

export async function getOwnedVideoRow(
  ownerId: string,
  id: string,
): Promise<{ video: VideoRow; document: DocumentRow | null }> {
  if (!isUuid(id)) throw notFound("No encontramos ese video.");

  const [row] = await db()
    .select({ video: schema.videos, document: schema.documents })
    .from(schema.videos)
    .leftJoin(schema.documents, eq(schema.documents.id, schema.videos.documentId))
    .where(and(eq(schema.videos.id, id), eq(schema.videos.ownerId, ownerId)))
    .limit(1);

  if (!row) throw notFound("No encontramos ese video.");
  return row;
}

export async function getVideo(ownerId: string, id: string): Promise<Video> {
  const { video, document } = await getOwnedVideoRow(ownerId, id);
  return toVideoDto(video, document);
}

/**
 * Deletes the video and its source document. Minutes are not refunded: they
 * paid for a generation that happened.
 */
export async function deleteVideo(ownerId: string, id: string) {
  const { video, document } = await getOwnedVideoRow(ownerId, id);

  // The voice-over is the only thing a video owns in a bucket; without this
  // the mp3s outlive the row that knew their keys and can never be found again.
  await Promise.all(
    (video.storyboard?.scenes ?? [])
      .map((scene) => scene.audio?.key)
      .filter((key): key is string => Boolean(key))
      .map((key) =>
        deleteObject("videos", key).catch((error) =>
          console.error(`[videos] no se pudo borrar ${key}`, error),
        ),
      ),
  );

  await db().delete(schema.videos).where(eq(schema.videos.id, video.id));
  if (document) await deleteDocument(document);
}

export async function setStage(id: string, stage: GenerationStage) {
  await db().update(schema.videos).set({ stage }).where(eq(schema.videos.id, id));
}
