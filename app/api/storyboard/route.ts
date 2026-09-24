/**
 * POST /api/storyboard — a document in, a drawable storyboard out.
 *
 * This is the one place the app actually talks to Claude. It takes the
 * multipart upload, pulls the text server-side, asks Claude for a storyboard
 * under the strict schema, repairs what needs repairing, and hands back
 * something the engine can draw immediately.
 *
 * The file never leaves this request: nothing is written to disk, nothing is
 * stored. Persistence arrives with the database.
 */

import { NextResponse } from "next/server";

import {
  DocumentExtractionError,
  extractDocumentText,
} from "@/lib/documents/extract";
import {
  StoryboardGenerationError,
  generateStoryboard,
} from "@/lib/storyboard/generate";
import { UPLOAD_LIMITS } from "@/lib/config";
import { getDocumentType } from "@/lib/utils";
import type { VideoDurationMinutes, VideoStyle } from "@/types";

// PDF and DOCX parsing both need Node APIs.
export const runtime = "nodejs";
// Claude thinks for a while on a long chapter.
export const maxDuration = 300;

const STYLES: VideoStyle[] = ["classic-whiteboard", "paper-desk", "color-markers"];
const DURATIONS: VideoDurationMinutes[] = [1, 3, 5];

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      "Falta ANTHROPIC_API_KEY. Añádela a .env.local y reinicia el servidor.",
      503,
      "missing_api_key",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("No pudimos leer el archivo enviado.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("Falta el documento.", 400);
  }
  if (file.size > UPLOAD_LIMITS.maxSizeBytes) {
    return fail("El archivo supera los 25 MB.", 413);
  }

  const documentType = getDocumentType(file.name);
  if (!documentType) {
    return fail(
      `Formato no soportado. Acepta ${UPLOAD_LIMITS.acceptedExtensions.join(", ")}.`,
      415,
    );
  }

  const style = STYLES.includes(form.get("style") as VideoStyle)
    ? (form.get("style") as VideoStyle)
    : "classic-whiteboard";
  const requested = Number(form.get("durationMinutes"));
  const durationMinutes = DURATIONS.includes(requested as VideoDurationMinutes)
    ? (requested as VideoDurationMinutes)
    : 3;
  const prompt = (form.get("prompt") as string | null)?.trim() || undefined;

  try {
    const extracted = await extractDocumentText(await file.arrayBuffer(), documentType);

    const { storyboard, warnings, clean } = await generateStoryboard({
      documentText: extracted.text,
      documentName: file.name,
      prompt,
      style,
      durationMinutes,
    });

    return NextResponse.json({
      storyboard,
      warnings,
      clean,
      document: {
        name: file.name,
        type: documentType,
        sizeBytes: file.size,
        pageCount: extracted.pageCount,
        pagesAnalyzed: extracted.pagesAnalyzed,
        truncated: extracted.truncated,
        totalCharacters: extracted.totalCharacters,
      },
    });
  } catch (cause) {
    if (cause instanceof DocumentExtractionError) {
      return fail(cause.message, 422, "extraction_failed");
    }
    if (cause instanceof StoryboardGenerationError) {
      return fail(cause.message, 502, "generation_failed");
    }
    console.error("[storyboard] fallo inesperado", cause);
    return fail("Algo falló generando el guion.", 500);
  }
}
