/**
 * Runtime configuration and integration switchboard.
 *
 * Nothing here talks to a real service yet. The point is that when the backend
 * lands, each flag flips to `true` and `lib/api.ts` swaps its mock branch for a
 * call through `lib/http.ts` — no component has to change.
 */

export const APP_NAME = "BreadBoardAI";
export const APP_TAGLINE =
  "Convierte tus PDFs y apuntes en videos whiteboard para estudiar más fácil";

/** Base URL of the future REST API (e.g. https://api.breadboard.ai/v1). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Flip to `true` per area as each backend piece ships.
 * While `false`, `lib/api.ts` serves mock data with simulated latency.
 */
export const features = {
  /** Auth provider (NextAuth / Clerk / custom JWT). */
  realAuth: false,
  /** Document upload to S3 or Cloudflare R2 via a presigned URL. */
  realUpload: false,
  /** Storyboard generation with the Claude API. */
  realStoryboard: false,
  /** Voice-over synthesis with ElevenLabs. */
  realVoiceover: false,
  /** Whiteboard video rendering with Remotion. */
  realRendering: false,
  /** Subscriptions and checkout through Recurrente. */
  realPayments: false,
} as const;

export type FeatureFlag = keyof typeof features;

/**
 * Where each provider will plug in. Kept as data so the integrations page /
 * docs can render it, and so nothing is hidden in a comment somewhere.
 */
export const integrations = [
  {
    id: "auth",
    provider: "Auth (JWT / NextAuth)",
    purpose: "Sesiones de estudiante y protección de rutas del dashboard.",
    entryPoint: "lib/auth-context.tsx + lib/api.ts#login",
  },
  {
    id: "storage",
    provider: "S3 / Cloudflare R2",
    purpose: "Guardar el PDF original y el MP4 renderizado.",
    entryPoint: "lib/api.ts#uploadDocument",
  },
  {
    id: "storyboard",
    provider: "Claude API (Anthropic)",
    purpose: "Leer el documento y escribir el storyboard escena por escena.",
    entryPoint: "lib/storyboard/generate.ts",
  },
  {
    id: "voice",
    provider: "ElevenLabs",
    purpose: "Narración en audio de cada escena del storyboard.",
    entryPoint: "lib/api.ts#createGenerationJob",
  },
  {
    id: "render",
    provider: "Remotion",
    purpose: "Renderizar el video whiteboard con la mano que escribe.",
    entryPoint: "lib/api.ts#createGenerationJob",
  },
  {
    id: "payments",
    provider: "Recurrente",
    purpose: "Checkout y suscripciones de los planes Student y Pro.",
    entryPoint: "lib/api.ts#createCheckoutSession",
  },
] as const;

/** Simulated network latency (ms) so the mock UI behaves like the real thing. */
export const MOCK_LATENCY = {
  fast: 350,
  normal: 700,
  slow: 1100,
} as const;

export const STORAGE_KEYS = {
  session: "breadboard.session",
  videos: "breadboard.videos",
} as const;

export const UPLOAD_LIMITS = {
  maxSizeBytes: 25 * 1024 * 1024,
  acceptedExtensions: [".pdf", ".docx", ".txt"],
  acceptAttribute:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.pdf,.docx,.txt",
} as const;
