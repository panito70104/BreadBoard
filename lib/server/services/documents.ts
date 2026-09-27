/**
 * Uploaded study documents: the bytes in object storage, the metadata in
 * Postgres, both keyed by the same id.
 */

import "server-only";

import { and, eq } from "drizzle-orm";

import { UPLOAD_LIMITS } from "@/lib/config";
import { db, schema } from "@/lib/server/db/client";
import { isUuid } from "@/lib/server/ids";
import { notFound, tooLarge, unsupported } from "@/lib/server/http";
import {
  deleteObject,
  getObjectBytes,
  objectKey,
  putObject,
} from "@/lib/server/storage";
import { getDocumentType } from "@/lib/utils";
import type { DocumentRow } from "@/lib/server/db/schema";
import type { StudyDocument } from "@/types";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
} as const;

export function validateUpload(file: File) {
  if (file.size === 0) throw unsupported("El archivo está vacío.");
  if (file.size > UPLOAD_LIMITS.maxSizeBytes) {
    throw tooLarge("El archivo supera los 25 MB.");
  }
  const type = getDocumentType(file.name);
  if (!type) {
    throw unsupported(
      `Formato no soportado. Acepta ${UPLOAD_LIMITS.acceptedExtensions.join(", ")}.`,
    );
  }
  return type;
}

/**
 * Stores the file first and the row second, so a row never points at an object
 * that does not exist. If the row insert fails, the orphaned object is removed.
 */
export async function createDocument(ownerId: string, file: File): Promise<DocumentRow> {
  const type = validateUpload(file);
  const id = crypto.randomUUID();
  const key = objectKey(ownerId, id, file.name);

  await putObject(
    "documents",
    key,
    new Uint8Array(await file.arrayBuffer()),
    CONTENT_TYPES[type],
  );

  try {
    const [row] = await db()
      .insert(schema.documents)
      .values({
        id,
        ownerId,
        name: file.name.slice(0, 255),
        type,
        sizeBytes: file.size,
        storageKey: key,
      })
      .returning();
    return row;
  } catch (error) {
    await deleteObject("documents", key).catch(() => undefined);
    throw error;
  }
}

export async function getOwnedDocument(ownerId: string, id: string): Promise<DocumentRow> {
  if (!isUuid(id)) throw notFound("No encontramos ese documento.");
  const [row] = await db()
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, id), eq(schema.documents.ownerId, ownerId)))
    .limit(1);
  if (!row) throw notFound("No encontramos ese documento.");
  return row;
}

export function readDocumentBytes(document: DocumentRow) {
  return getObjectBytes("documents", document.storageKey);
}

export async function setPageCount(id: string, pageCount: number | undefined) {
  if (!pageCount) return;
  await db().update(schema.documents).set({ pageCount }).where(eq(schema.documents.id, id));
}

/** Removes the object and the row. Storage first: a dangling row is worse. */
export async function deleteDocument(document: DocumentRow) {
  await deleteObject("documents", document.storageKey).catch((error) => {
    console.error("[documents] no se pudo borrar el objeto", document.storageKey, error);
  });
  await db().delete(schema.documents).where(eq(schema.documents.id, document.id));
}

export function toDocumentDto(row: DocumentRow): StudyDocument {
  return {
    id: row.id,
    name: row.name,
    type: row.type as StudyDocument["type"],
    sizeBytes: row.sizeBytes,
    pageCount: row.pageCount ?? undefined,
    uploadedAt: row.createdAt.toISOString(),
    storageKey: row.storageKey,
  };
}
