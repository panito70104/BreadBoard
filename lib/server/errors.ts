/**
 * Typed HTTP errors. Thrown anywhere on the server, turned into a structured
 * JSON response by `route()` in `lib/server/http.ts`.
 */

import "server-only";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, code = "bad_request") =>
  new HttpError(400, message, code);
export const unauthorized = (message = "Inicia sesión para continuar.") =>
  new HttpError(401, message, "unauthorized");
export const paymentRequired = (message: string, code = "quota_exceeded") =>
  new HttpError(402, message, code);
export const forbidden = (message: string, code = "forbidden") =>
  new HttpError(403, message, code);
/** Used for both "missing" and "not yours", so ids cannot be probed. */
export const notFound = (message = "No encontramos lo que buscas.") =>
  new HttpError(404, message, "not_found");
export const conflict = (message: string, code = "conflict") =>
  new HttpError(409, message, code);
export const unsupported = (message: string) =>
  new HttpError(415, message, "unsupported_media_type");
export const unprocessable = (message: string, code = "unprocessable") =>
  new HttpError(422, message, code);
export const tooLarge = (message: string) => new HttpError(413, message, "too_large");

export function tooManyRequests(retryAfterMs: number, label?: string) {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const minutes = Math.ceil(seconds / 60);
  return new HttpError(
    429,
    seconds < 60
      ? `Demasiadas ${label ?? "peticiones"}. Espera ${seconds} s.`
      : `Demasiados ${label ?? "intentos"}. Vuelve a intentarlo en ${minutes} min.`,
    "rate_limited",
    { "retry-after": String(seconds) },
  );
}
