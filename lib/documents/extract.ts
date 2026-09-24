/**
 * Pulls the study text out of an uploaded document.
 *
 * SERVER ONLY — `unpdf` and `mammoth` both need Node.
 *
 * A whole textbook does not belong in one prompt: it costs a fortune and
 * buries the chapter the student actually asked about. So the extractor caps
 * what it returns and **reports the cap** instead of silently truncating —
 * the UI tells the student how much was analysed, and they can upload a
 * narrower chapter if that is not what they meant.
 */

import type { DocumentType } from "@/types";

/** ~45k tokens of input: enough for a long chapter, sane as a bill. */
export const MAX_CHARACTERS = 180_000;

export interface ExtractedDocument {
  text: string;
  /** Characters before any cap was applied. */
  totalCharacters: number;
  /** True when the document was longer than `MAX_CHARACTERS`. */
  truncated: boolean;
  /** Pages in the source, when the format knows. */
  pageCount?: number;
  /** Pages actually included after the cap. */
  pagesAnalyzed?: number;
}

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

function tidy(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    // Books hyphenate across line breaks; rejoin so words stay words.
    .replace(/([a-záéíóúñ])-\n([a-záéíóúñ])/gi, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });

  const pages = (Array.isArray(text) ? text : [text]).map(tidy);
  const full = pages.join("\n\n");

  if (full.length <= MAX_CHARACTERS) {
    return {
      text: full,
      totalCharacters: full.length,
      truncated: false,
      pageCount: totalPages,
      pagesAnalyzed: totalPages,
    };
  }

  // Cut on a page boundary so the model never sees half a paragraph.
  let kept = "";
  let pagesAnalyzed = 0;
  for (const page of pages) {
    if (kept.length + page.length > MAX_CHARACTERS) break;
    kept += (kept ? "\n\n" : "") + page;
    pagesAnalyzed += 1;
  }

  return {
    text: kept || full.slice(0, MAX_CHARACTERS),
    totalCharacters: full.length,
    truncated: true,
    pageCount: totalPages,
    pagesAnalyzed: Math.max(1, pagesAnalyzed),
  };
}

async function extractDocx(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const text = tidy(value);
  return {
    text: text.slice(0, MAX_CHARACTERS),
    totalCharacters: text.length,
    truncated: text.length > MAX_CHARACTERS,
  };
}

function extractTxt(buffer: ArrayBuffer): ExtractedDocument {
  const text = tidy(new TextDecoder().decode(buffer));
  return {
    text: text.slice(0, MAX_CHARACTERS),
    totalCharacters: text.length,
    truncated: text.length > MAX_CHARACTERS,
  };
}

export async function extractDocumentText(
  buffer: ArrayBuffer,
  type: DocumentType,
): Promise<ExtractedDocument> {
  let result: ExtractedDocument;

  try {
    result =
      type === "pdf"
        ? await extractPdf(buffer)
        : type === "docx"
          ? await extractDocx(buffer)
          : extractTxt(buffer);
  } catch (cause) {
    // Worth a log: a parser failure is the kind of thing you only diagnose
    // from the original error, and the student's message hides it.
    console.error("[extract] no se pudo leer el documento", cause);
    throw new DocumentExtractionError(
      "No pudimos abrir el documento. ¿Está protegido con contraseña o dañado?",
    );
  }

  // A scanned PDF parses fine and yields almost nothing — catch it here rather
  // than paying Claude to summarise whitespace.
  if (result.text.replace(/\s/g, "").length < 200) {
    throw new DocumentExtractionError(
      "Este documento no tiene texto legible. Si es un escaneo o fotos, necesitaríamos OCR.",
    );
  }

  return result;
}
