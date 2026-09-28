/**
 * Object storage over the S3 API.
 *
 * Locally this talks to the RustFS container; on Supabase it talks to Supabase
 * Storage's S3-compatible endpoint. Same client, same calls — the migration is
 * endpoint and credentials in `.env`.
 *
 * Buckets are private. Nothing is ever served straight from a bucket: reads go
 * through short-lived signed URLs issued after an ownership check.
 */

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/server/env";

export type BucketName = "documents" | "videos";

const globalForStorage = globalThis as unknown as { breadboardS3?: S3Client };

function client(): S3Client {
  if (!globalForStorage.breadboardS3) {
    const config = env();
    globalForStorage.breadboardS3 = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return globalForStorage.breadboardS3;
}

function bucket(name: BucketName): string {
  const config = env();
  return name === "documents" ? config.S3_BUCKET_DOCUMENTS : config.S3_BUCKET_VIDEOS;
}

/**
 * Keys start with the owner's id — the convention Supabase Storage policies
 * use to scope a bucket to its owner (`(storage.foldername(name))[1]`).
 */
export function objectKey(ownerId: string, recordId: string, fileName: string) {
  const safe = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120);
  return `${ownerId}/${recordId}/${safe}`;
}

export async function putObject(
  name: BucketName,
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(name),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectBytes(name: BucketName, key: string): Promise<Uint8Array> {
  const result = await client().send(
    new GetObjectCommand({ Bucket: bucket(name), Key: key }),
  );
  if (!result.Body) throw new Error(`Objeto vacío: ${key}`);
  return result.Body.transformToByteArray();
}

export async function objectSize(name: BucketName, key: string): Promise<number> {
  const result = await client().send(
    new HeadObjectCommand({ Bucket: bucket(name), Key: key }),
  );
  return result.ContentLength ?? 0;
}

/** One slice of an object, as a byte-range read answers it. */
export interface ObjectSlice {
  bytes: Uint8Array;
  /** Inclusive offsets actually served. */
  start: number;
  end: number;
  /** Size of the whole object. */
  total: number;
  /** False when the whole object came back. */
  partial: boolean;
}

/** The caller asked for bytes the object does not have. */
export class RangeNotSatisfiable extends Error {
  constructor(readonly total: number | null) {
    super("Rango fuera del objeto.");
    this.name = "RangeNotSatisfiable";
  }
}

/**
 * Reads an object, or one byte range of it.
 *
 * The range is pushed down to S3 instead of being applied after the fact. A
 * media player does not fetch a file once: it seeks, and every seek is a range
 * request — so slicing a full download would turn each seek into a whole
 * transfer of the file and a pause in the middle of a sentence. That is not
 * only slow: a stalled read is exactly what makes Remotion pull the audio back
 * into sync and replay the second before it.
 */
export async function getObjectRange(
  name: BucketName,
  key: string,
  range?: string | null,
): Promise<ObjectSlice> {
  let result;
  try {
    result = await client().send(
      new GetObjectCommand({ Bucket: bucket(name), Key: key, Range: range || undefined }),
    );
  } catch (cause) {
    const unsatisfiable =
      cause instanceof Error &&
      (cause.name === "InvalidRange" ||
        (cause as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 416);
    // 416 has to carry the real size, so the player learns what it may ask for.
    if (unsatisfiable) {
      throw new RangeNotSatisfiable(await objectSize(name, key).catch(() => null));
    }
    throw cause;
  }

  if (!result.Body) throw new Error(`Objeto vacío: ${key}`);
  const bytes = await result.Body.transformToByteArray();

  // "bytes 0-1023/98765" on a partial read; absent when the whole object came.
  const served = result.ContentRange?.match(/bytes (\d+)-(\d+)\/(\d+)/);
  if (served) {
    return {
      bytes,
      start: Number(served[1]),
      end: Number(served[2]),
      total: Number(served[3]),
      partial: true,
    };
  }

  return {
    bytes,
    start: 0,
    end: Math.max(0, bytes.byteLength - 1),
    total: bytes.byteLength,
    partial: false,
  };
}

export async function deleteObject(name: BucketName, key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(name), Key: key }));
}

/** Time-limited read URL. Only issue after checking the caller owns the object. */
export async function signedReadUrl(
  name: BucketName,
  key: string,
  { expiresInSeconds = 300, downloadAs }: { expiresInSeconds?: number; downloadAs?: string } = {},
) {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(name),
      Key: key,
      ResponseContentDisposition: downloadAs
        ? `attachment; filename="${downloadAs.replace(/"/g, "")}"`
        : undefined,
    }),
    { expiresIn: expiresInSeconds },
  );
}

/** Creates the buckets if they are missing. Local setup only — Supabase buckets are made in its dashboard. */
export async function ensureBuckets(): Promise<string[]> {
  const created: string[] = [];
  for (const name of ["documents", "videos"] as const) {
    const bucketName = bucket(name);
    try {
      await client().send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      await client().send(new CreateBucketCommand({ Bucket: bucketName }));
      created.push(bucketName);
    }
  }
  return created;
}
