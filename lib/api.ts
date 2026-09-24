/**
 * Mock API layer.
 *
 * Every function here is the exact call site a real backend will take over.
 * They are async, they simulate latency, they can fail, and they only return
 * types from `@/types` — so components never learn where data comes from.
 *
 * Replacing a mock looks like this:
 *
 *   export async function getVideos(): Promise<Video[]> {
 *     if (features.realRendering) return apiFetch<Video[]>("/videos");
 *     ...mock branch...
 *   }
 */

import {
  buildStoryboard,
  generationSteps,
  mockPlans,
} from "@/data/mock";
import { MOCK_LATENCY, UPLOAD_LIMITS } from "@/lib/config";
import {
  createId,
  getDocumentType,
  nameFromEmail,
  sleep,
  titleFromFileName,
} from "@/lib/utils";
import type {
  AuthSession,
  Storyboard,
  StoryboardWarning,
  GenerationJob,
  GenerationJobInput,
  GenerationStep,
  GenerationStepId,
  LoginCredentials,
  StudyDocument,
  SubscriptionPlan,
  User,
  Video,
} from "@/types";

/**
 * In-memory stores so mock mutations survive client-side navigation.
 * They start empty: the app has no sample content, only what gets uploaded.
 */
const videoStore: Video[] = [];
const documentStore: StudyDocument[] = [];

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Every new account starts on the Free plan's monthly minute quota. */
function freeMinuteQuota() {
  return mockPlans.find((plan) => plan.id === "free")?.minutesPerMonth ?? 0;
}

function issueSession(user: User): AuthSession {
  return {
    user,
    token: `mock_token_${createId("t")}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mock login. Accepts any well-formed email with a password of 6+ characters.
 * TODO(backend): POST /auth/login and store the returned session cookie.
 */
export async function loginMock(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  await sleep(MOCK_LATENCY.normal);

  const emailLooksValid = /.+@.+\..+/.test(credentials.email);
  if (!emailLooksValid) {
    throw new Error("Escribe un correo válido.");
  }
  if (credentials.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  // No user database: the account is derived from what was typed in.
  return issueSession({
    id: createId("usr"),
    name: nameFromEmail(credentials.email),
    email: credentials.email,
    planId: "free",
    createdAt: new Date().toISOString(),
    minutesUsed: 0,
    minutesLimit: freeMinuteQuota(),
  });
}

/** TODO(backend): POST /auth/signup */
export async function signupMock(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  await sleep(MOCK_LATENCY.normal);

  if (!input.name.trim()) throw new Error("Escribe tu nombre.");
  if (!/.+@.+\..+/.test(input.email)) throw new Error("Escribe un correo válido.");
  if (input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }

  return issueSession({
    id: createId("usr"),
    name: input.name.trim(),
    email: input.email,
    planId: "free",
    createdAt: new Date().toISOString(),
    minutesUsed: 0,
    minutesLimit: freeMinuteQuota(),
  });
}

/** TODO(backend): POST /auth/password-reset */
export async function requestPasswordResetMock(email: string): Promise<void> {
  await sleep(MOCK_LATENCY.normal);
  if (!/.+@.+\..+/.test(email)) throw new Error("Escribe un correo válido.");
}

/**
 * Resolves the signed-in user. Without a stored session there is nobody to
 * return — no demo account stands in for one.
 * TODO(backend): GET /auth/me, which answers 401 when there is no session.
 */
export async function getCurrentUserMock(): Promise<User | null> {
  await sleep(MOCK_LATENCY.fast);
  return null;
}

/** TODO(backend): POST /auth/logout */
export async function logoutMock(): Promise<void> {
  await sleep(MOCK_LATENCY.fast);
}

/* -------------------------------------------------------------------------- */
/*                                  Documents                                 */
/* -------------------------------------------------------------------------- */

/**
 * Mock upload. Reports progress like a real XHR/presigned-URL upload would.
 * TODO(backend): request a presigned S3/R2 URL, PUT the file, then POST the key.
 */
export async function uploadDocumentMock(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<StudyDocument> {
  const type = getDocumentType(file.name);
  if (!type) {
    throw new Error(
      `Formato no soportado. Acepta ${UPLOAD_LIMITS.acceptedExtensions.join(", ")}.`,
    );
  }
  if (file.size > UPLOAD_LIMITS.maxSizeBytes) {
    throw new Error("El archivo supera los 25 MB.");
  }

  for (let percent = 0; percent <= 100; percent += 20) {
    onProgress?.(percent);
    await sleep(120);
  }

  const document: StudyDocument = {
    id: createId("doc"),
    name: file.name,
    type,
    sizeBytes: file.size,
    pageCount: Math.max(1, Math.round(file.size / 120_000)),
    uploadedAt: new Date().toISOString(),
    storageKey: `mock/uploads/${createId("key")}`,
  };

  documentStore.unshift(document);
  return clone(document);
}

/** TODO(backend): GET /documents */
export async function getDocumentsMock(): Promise<StudyDocument[]> {
  await sleep(MOCK_LATENCY.fast);
  return clone(documentStore);
}

/* -------------------------------------------------------------------------- */
/*                                 Generation                                 */
/* -------------------------------------------------------------------------- */

/** Fresh copy of the pipeline steps, all pending. */
export function createGenerationSteps(): GenerationStep[] {
  return generationSteps.map((step) => ({ ...step }));
}

const STEP_ORDER: GenerationStepId[] = [
  "uploading",
  "reading",
  "storyboarding",
  "rendering",
  "ready",
];

/** How long each mock step pretends to take. */
const STEP_DURATION_MS: Record<GenerationStepId, number> = {
  uploading: 1200,
  reading: 1800,
  storyboarding: 2200,
  rendering: 2800,
  ready: 500,
};

export interface GenerationProgressUpdate {
  job: GenerationJob;
  video?: Video;
}

/**
 * Mock generation job. Walks the five pipeline steps, emitting an update on
 * every transition, and resolves with the finished video.
 *
 * TODO(backend): POST /generation-jobs, then subscribe to job updates over
 * SSE/WebSocket (Claude writes the storyboard, ElevenLabs the voice-over and
 * Remotion renders the MP4 into S3/R2).
 */
export async function createGenerationJobMock(
  input: GenerationJobInput & { title?: string },
  onUpdate?: (update: GenerationProgressUpdate) => void,
): Promise<Video> {
  const sourceDocument = documentStore.find((doc) => doc.id === input.documentId);
  if (!sourceDocument) {
    throw new Error("No encontramos el documento. Vuelve a subirlo.");
  }

  const job: GenerationJob = {
    id: createId("job"),
    documentId: input.documentId,
    status: "uploading",
    progress: 0,
    steps: createGenerationSteps(),
    createdAt: new Date().toISOString(),
  };

  const emit = () => onUpdate?.({ job: clone(job) });

  for (const [index, stepId] of STEP_ORDER.entries()) {
    job.status = stepId;
    job.steps = job.steps.map((step) => ({
      ...step,
      state:
        step.id === stepId
          ? "active"
          : STEP_ORDER.indexOf(step.id) < index
            ? "done"
            : "pending",
    }));

    const stepStart = (index / STEP_ORDER.length) * 100;
    const stepEnd = ((index + 1) / STEP_ORDER.length) * 100;
    const ticks = 6;

    for (let tick = 1; tick <= ticks; tick += 1) {
      job.progress = Math.round(stepStart + ((stepEnd - stepStart) * tick) / ticks);
      emit();
      await sleep(STEP_DURATION_MS[stepId] / ticks);
    }
  }

  job.steps = job.steps.map((step) => ({ ...step, state: "done" }));
  job.status = "ready";
  job.progress = 100;

  const videoId = createId("vid");
  const title = input.title?.trim() || titleFromFileName(sourceDocument.name);

  const video: Video = {
    id: videoId,
    title,
    status: "ready",
    createdAt: new Date().toISOString(),
    durationSeconds: input.durationMinutes * 60,
    style: input.style,
    sourceDocument,
    prompt: input.prompt,
    storyboard: buildStoryboard(title.toLowerCase(), videoId),
  };

  job.videoId = videoId;
  videoStore.unshift(video);
  onUpdate?.({ job: clone(job), video: clone(video) });

  return clone(video);
}

/* -------------------------------------------------------------------------- */
/*                              Real generation                               */
/* -------------------------------------------------------------------------- */

export interface RealGenerationResult {
  video: Video;
  /** What the validator had to repair in Claude's output. */
  warnings: StoryboardWarning[];
  /** Set when the document was longer than one prompt can hold. */
  notice?: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY en .env.local.");
    this.name = "MissingApiKeyError";
  }
}

/**
 * The real path: sends the document to `/api/storyboard`, which extracts its
 * text and asks Claude for a storyboard. Unlike the mocks around it, this one
 * costs money and reads the actual file.
 */
export async function generateVideoFromFile(
  file: File,
  input: Omit<GenerationJobInput, "documentId">,
  onUpdate?: (update: GenerationProgressUpdate) => void,
): Promise<RealGenerationResult> {
  const job: GenerationJob = {
    id: createId("job"),
    documentId: createId("doc"),
    status: "uploading",
    progress: 0,
    steps: createGenerationSteps(),
    createdAt: new Date().toISOString(),
  };

  /** Moves the visible pipeline to a step and holds it there while we wait. */
  const enter = (stepId: GenerationStepId, progress: number) => {
    const at = STEP_ORDER.indexOf(stepId);
    job.status = stepId;
    job.progress = progress;
    job.steps = job.steps.map((step) => ({
      ...step,
      state:
        step.id === stepId
          ? "active"
          : STEP_ORDER.indexOf(step.id) < at
            ? "done"
            : "pending",
    }));
    onUpdate?.({ job: clone(job) });
  };

  enter("uploading", 8);

  const body = new FormData();
  body.set("file", file);
  body.set("style", input.style);
  body.set("durationMinutes", String(input.durationMinutes));
  if (input.prompt) body.set("prompt", input.prompt);

  const response = await fetch("/api/storyboard", { method: "POST", body });
  enter("reading", 32);

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (payload?.code === "missing_api_key") throw new MissingApiKeyError();
    throw new Error(payload?.error ?? "No pudimos generar el guion.");
  }

  enter("storyboarding", 62);

  const storyboard = payload.storyboard as Storyboard;
  const document: StudyDocument = {
    id: job.documentId,
    name: payload.document.name,
    type: payload.document.type,
    sizeBytes: payload.document.sizeBytes,
    pageCount: payload.document.pageCount,
    uploadedAt: new Date().toISOString(),
  };
  documentStore.unshift(document);

  enter("rendering", 88);

  const video: Video = {
    id: createId("vid"),
    title: storyboard.videoTitle || titleFromFileName(file.name),
    status: "ready",
    createdAt: new Date().toISOString(),
    durationSeconds: storyboard.totalSeconds,
    style: input.style,
    sourceDocument: document,
    prompt: input.prompt,
    storyboard: storyboard.scenes,
  };

  videoStore.unshift(video);

  job.steps = job.steps.map((step) => ({ ...step, state: "done" }));
  job.status = "ready";
  job.progress = 100;
  job.videoId = video.id;
  onUpdate?.({ job: clone(job), video: clone(video) });

  const { pagesAnalyzed, pageCount, truncated } = payload.document;
  return {
    video: clone(video),
    warnings: payload.warnings ?? [],
    notice: truncated
      ? `El documento tiene ${pageCount ?? "muchas"} páginas; analizamos las primeras ${pagesAnalyzed ?? "que cupieron"}.`
      : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Videos                                   */
/* -------------------------------------------------------------------------- */

/** TODO(backend): GET /videos */
export async function getVideosMock(): Promise<Video[]> {
  await sleep(MOCK_LATENCY.normal);
  return clone(videoStore);
}

/** TODO(backend): GET /videos/:id */
export async function getVideoByIdMock(id: string): Promise<Video | null> {
  await sleep(MOCK_LATENCY.fast);
  const video = videoStore.find((item) => item.id === id);
  return video ? clone(video) : null;
}

/** TODO(backend): POST /videos/:id/regenerate */
export async function regenerateVideoMock(id: string): Promise<Video> {
  await sleep(MOCK_LATENCY.slow);
  const video = videoStore.find((item) => item.id === id);
  if (!video) throw new Error("No encontramos ese video.");

  video.status = "generating";
  video.progress = 0;
  video.error = undefined;
  video.createdAt = new Date().toISOString();
  return clone(video);
}

/** TODO(backend): DELETE /videos/:id */
export async function deleteVideoMock(id: string): Promise<void> {
  await sleep(MOCK_LATENCY.fast);
  const index = videoStore.findIndex((item) => item.id === id);
  if (index >= 0) videoStore.splice(index, 1);
}

/* -------------------------------------------------------------------------- */
/*                                   Billing                                  */
/* -------------------------------------------------------------------------- */

/** TODO(backend): GET /plans */
export async function getPricingPlansMock(): Promise<SubscriptionPlan[]> {
  await sleep(MOCK_LATENCY.fast);
  return clone(mockPlans);
}

/**
 * Mock checkout. Returns the URL the browser would be redirected to.
 * TODO(backend): POST /billing/checkout against Recurrente and redirect.
 */
export async function createCheckoutSessionMock(
  planId: SubscriptionPlan["id"],
): Promise<{ checkoutUrl: string }> {
  await sleep(MOCK_LATENCY.normal);
  return { checkoutUrl: `/billing?mock_checkout=${planId}` };
}

/* -------------------------------------------------------------------------- */
/*            Aliases: the names the app will keep using post-backend          */
/* -------------------------------------------------------------------------- */

export {
  loginMock as login,
  signupMock as signup,
  logoutMock as logout,
  getCurrentUserMock as getCurrentUser,
  uploadDocumentMock as uploadDocument,
  getDocumentsMock as getDocuments,
  createGenerationJobMock as createGenerationJob,
  getVideosMock as getVideos,
  getVideoByIdMock as getVideoById,
  regenerateVideoMock as regenerateVideo,
  deleteVideoMock as deleteVideo,
  getPricingPlansMock as getPricingPlans,
  createCheckoutSessionMock as createCheckoutSession,
};
