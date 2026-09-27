/**
 * Client-safe constants. Server configuration lives in `lib/server/env.ts`,
 * which validates every variable at startup.
 */

export const APP_NAME = "BreadBoardAI";
export const APP_TAGLINE =
  "Convierte tus PDFs y apuntes en videos whiteboard para estudiar más fácil";

export const UPLOAD_LIMITS = {
  maxSizeBytes: 25 * 1024 * 1024,
  acceptedExtensions: [".pdf", ".docx", ".txt"],
  acceptAttribute:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.pdf,.docx,.txt",
} as const;
