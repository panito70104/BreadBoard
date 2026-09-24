/**
 * Thin fetch wrapper for the future backend.
 *
 * It is intentionally unused while every call in `lib/api.ts` is mocked: the
 * moment a real endpoint exists, a mock branch becomes
 * `return apiFetch<Video[]>("/videos")` and nothing else moves.
 */

import { API_BASE_URL } from "@/lib/config";
import type { ApiError } from "@/types";

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, payload: ApiError) {
    super(payload.message);
    this.name = "HttpError";
    this.status = status;
    this.code = payload.code;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Bearer token; will come from the auth provider once it exists. */
  token?: string | null;
}

export async function apiFetch<T>(
  path: string,
  { body, token, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({ message: response.statusText }))) as ApiError;
    throw new HttpError(response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
