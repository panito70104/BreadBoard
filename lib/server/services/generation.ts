/**
 * Video generation — the pipeline the product is.
 *
 *   startGeneration   (in the request)   validate -> store document ->
 *                                        reserve minutes + create video (one tx)
 *   runGeneration     (after response)   read -> extract text -> storyboard ->
 *                                        fit to paid duration -> ready
 *
 * The request returns as soon as the video row exists, so the student can
 * leave the page; the client polls for the result. Any failure in the second
 * half marks the video failed and refunds its minutes — the student never
 * pays for a video they did not get.
 *
 * TODO(queue): `after()` runs in the same process. Past a handful of
 * concurrent users, move `runGeneration` to a real queue (pg-boss on Postgres
 * works here and on Supabase) so a deploy mid-generation cannot drop work.
 * `reapStaleGenerations` covers that case in the meantime.
 */

import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";

import {
  DocumentExtractionError,
  extractDocumentText,
} from "@/lib/documents/extract";
import type { AuthUser } from "@/lib/server/auth/dal";
import { db, schema } from "@/lib/server/db/client";
import { badRequest, conflict, paymentRequired } from "@/lib/server/http";
import { StoryboardGenerationError } from "@/lib/storyboard/generate";
import { titleFromFileName } from "@/lib/utils";
import type { DocumentType, Video } from "@/types";

import {
  createDocument,
  deleteDocument,
  readDocumentBytes,
  setPageCount,
  validateUpload,
} from "./documents";
import {
  MOCK_NOTICE,
  fitToDuration,
  produceStoryboard,
  resolveProvider,
} from "./storyboard-provider";
import {
  refundMinutes,
  reserveMinutes,
  settleMinutes,
  type UsageSummary,
  usageSummary,
} from "./usage";
import {
  STALE_GENERATION_MS,
  getOwnedVideoRow,
  getVideo,
  setStage,
  toVideoDto,
} from "./videos";
import { narrate } from "./voice";

export const generationOptionsSchema = z.object({
  style: z.enum(["classic-whiteboard", "paper-desk", "color-markers"], {
    message: "Estilo de video no válido.",
  }),
  prompt: z
    .string()
    .trim()
    .max(500, "La petición es demasiado larga (máximo 500 caracteres).")
    .optional()
    .transform((value) => value || undefined),
});

/**
 * Minutes to hold before a generation starts.
 *
 * The student no longer picks a length, so nobody knows what the video will
 * cost until it exists. The hold is therefore the most it could cost — the
 * longest video the plan allows, or whatever is left of the month if that is
 * less — and `settleMinutes` gives back the difference once the real length is
 * known. Holding the worst case is what keeps two tabs from spending the same
 * last minutes twice.
 */
function holdFor(usage: UsageSummary): number {
  return Math.min(usage.maxVideoMinutes, usage.minutesRemaining);
}

/* -------------------------------------------------------------------------- */
/*                                  Start                                     */
/* -------------------------------------------------------------------------- */

export async function startGeneration(user: AuthUser, form: FormData): Promise<Video> {
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Falta el documento.");

  const options = generationOptionsSchema.parse({
    style: form.get("style") ?? "classic-whiteboard",
    prompt: form.get("prompt") ?? undefined,
  });

  // Everything that can reject the request, before any file is stored.
  validateUpload(file);

  const usage = await usageSummary(user.id, user.planId);
  const hold = holdFor(usage);
  if (hold < 1) {
    throw paymentRequired(
      `Ya usaste tus ${usage.minutesLimit} minutos de este mes. Sube de plan o espera al próximo ciclo.`,
    );
  }

  const document = await createDocument(user.id, file);

  try {
    const video = await db().transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.videos)
        .values({
          ownerId: user.id,
          documentId: document.id,
          title: titleFromFileName(file.name),
          status: "generating",
          stage: "queued",
          style: options.style,
          requestedMinutes: hold,
          prompt: options.prompt,
          source: resolveProvider(),
        })
        .returning();

      // The authoritative quota check, under a lock. Throws (and rolls back
      // the insert above) if a parallel request took the last minutes.
      await reserveMinutes(tx, { ownerId: user.id, videoId: row.id, minutes: hold });

      return row;
    });

    return toVideoDto(video, document);
  } catch (error) {
    await deleteDocument(document);
    throw error;
  }
}

/** Re-runs a finished or failed video on its original document. Costs minutes again. */
export async function restartGeneration(user: AuthUser, videoId: string): Promise<Video> {
  const { video, document } = await getOwnedVideoRow(user.id, videoId);

  if (video.status === "generating") {
    throw conflict("Este video ya se está generando.", "already_generating");
  }
  if (!document) {
    throw conflict("El documento original ya no existe. Súbelo de nuevo.", "document_missing");
  }
  const usage = await usageSummary(user.id, user.planId);
  const hold = holdFor(usage);
  if (hold < 1) {
    throw paymentRequired(
      `Ya usaste tus ${usage.minutesLimit} minutos de este mes. Sube de plan o espera al próximo ciclo.`,
    );
  }

  await db().transaction(async (tx) => {
    await tx
      .update(schema.videos)
      .set({
        status: "generating",
        stage: "queued",
        error: null,
        notice: null,
        requestedMinutes: hold,
        source: resolveProvider(),
      })
      .where(eq(schema.videos.id, video.id));

    await reserveMinutes(tx, { ownerId: user.id, videoId: video.id, minutes: hold });
  });

  return getVideo(user.id, videoId);
}

/* -------------------------------------------------------------------------- */
/*                                   Run                                      */
/* -------------------------------------------------------------------------- */

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** The slow half. Never throws: every failure lands on the video row. */
export async function runGeneration(videoId: string): Promise<void> {
  const [row] = await db()
    .select({ video: schema.videos, document: schema.documents })
    .from(schema.videos)
    .leftJoin(schema.documents, eq(schema.documents.id, schema.videos.documentId))
    .where(eq(schema.videos.id, videoId))
    .limit(1);

  if (!row || row.video.status !== "generating") return;
  const { video, document } = row;

  try {
    if (!document) throw new DocumentExtractionError("El documento ya no existe.");

    await setStage(video.id, "reading");
    const bytes = await readDocumentBytes(document);
    const extracted = await extractDocumentText(
      toArrayBuffer(bytes),
      document.type as DocumentType,
    );
    await setPageCount(document.id, extracted.pageCount);

    await setStage(video.id, "storyboarding");
    const { result, source } = await produceStoryboard({
      documentText: extracted.text,
      documentName: document.name,
      prompt: video.prompt ?? undefined,
      // The model picks the length; this is only the ceiling it may pick from.
      allowedSeconds: video.requestedMinutes * 60,
      documentWords: extracted.text.split(/\s+/).filter(Boolean).length,
      documentPages: extracted.pageCount,
      style: video.style as "classic-whiteboard",
      title: video.title,
    });

    // Shape the plan to the length the model chose, then let the voice decide
    // how long the scenes really are — a sentence takes as long as it takes.
    const targetSeconds = result.storyboard.targetSeconds;
    const planned = fitToDuration(result.storyboard, targetSeconds);

    await setStage(video.id, "voicing");
    const narration = await narrate(planned, {
      ownerId: video.ownerId,
      videoId: video.id,
      targetSeconds,
    });
    const storyboard = narration.storyboard;

    await setStage(video.id, "finalizing");

    const notices = [
      source === "mock" ? MOCK_NOTICE : null,
      narration.voiced === 0 && narration.warnings.length > 0
        ? "Este video salió sin voz. Puedes volver a generarlo cuando el servicio de voz esté disponible."
        : null,
      narration.voiced > 0 && narration.voiced < storyboard.scenes.length
        ? `Narramos ${narration.voiced} de ${storyboard.scenes.length} escenas; el resto quedó en silencio.`
        : null,
      extracted.truncated
        ? `El documento tiene ${extracted.pageCount ?? "muchas"} páginas; analizamos las primeras ${extracted.pagesAnalyzed ?? "que cupieron"}. Para otro capítulo, sube solo esas páginas.`
        : null,
    ].filter(Boolean);

    // What the video actually came out at, which is what it costs. The rest of
    // the hold goes back.
    const chargedMinutes = Math.max(1, Math.ceil(storyboard.totalSeconds / 60));
    await settleMinutes({
      ownerId: video.ownerId,
      videoId: video.id,
      reserved: video.requestedMinutes,
      actual: chargedMinutes,
    });

    await db()
      .update(schema.videos)
      .set({
        status: "ready",
        requestedMinutes: chargedMinutes,
        stage: "done",
        title: source === "claude" && storyboard.videoTitle ? storyboard.videoTitle : video.title,
        storyboard,
        warnings: [...result.warnings, ...narration.warnings],
        durationSeconds: storyboard.totalSeconds,
        source,
        notice: notices.length ? notices.join(" ") : null,
        error: null,
      })
      .where(eq(schema.videos.id, video.id));
  } catch (error) {
    const known =
      error instanceof DocumentExtractionError || error instanceof StoryboardGenerationError;
    if (!known) console.error(`[generation] ${video.id} falló`, error);

    await failAndRefund(
      video.id,
      video.ownerId,
      video.requestedMinutes,
      known ? error.message : "No pudimos generar el video. No se te cobraron los minutos.",
    );
  }
}

async function failAndRefund(videoId: string, ownerId: string, minutes: number, message: string) {
  await db()
    .update(schema.videos)
    .set({ status: "failed", error: message })
    .where(eq(schema.videos.id, videoId));
  await refundMinutes({ ownerId, videoId, minutes });
}

/**
 * A server restart mid-generation leaves a video stuck in `generating` with its
 * minutes reserved. Anything untouched for too long is failed and refunded.
 * Cheap enough to run on every list request.
 */
export async function reapStaleGenerations(ownerId: string) {
  const cutoff = new Date(Date.now() - STALE_GENERATION_MS);
  const stale = await db()
    .update(schema.videos)
    .set({
      status: "failed",
      error: "La generación se interrumpió. No se te cobraron los minutos; inténtalo de nuevo.",
    })
    .where(
      and(
        eq(schema.videos.ownerId, ownerId),
        eq(schema.videos.status, "generating"),
        lt(schema.videos.updatedAt, cutoff),
      ),
    )
    .returning({ id: schema.videos.id, minutes: schema.videos.requestedMinutes });

  for (const video of stale) {
    await refundMinutes({ ownerId, videoId: video.id, minutes: video.minutes });
  }
}
