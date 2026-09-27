/**
 * Client for the BreadBoard API.
 *
 * Every component talks to the server through here and nowhere else, so the
 * transport (fetch today, Supabase client tomorrow) is a one-file change.
 * Functions return domain types from `@/types` and throw `ApiError` with the
 * server's message, which is already written for the student to read.
 */

import { generationSteps } from "@/data/mock";
import type {
  GenerationStage,
  GenerationStep,
  GenerationStepId,
  LoginCredentials,
  ServiceStatus,
  SubscriptionPlan,
  User,
  UserPreferences,
  Video,
  VideoDurationMinutes,
  VideoStyle,
} from "@/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers:
        init.body && !(init.body instanceof FormData)
          ? { "content-type": "application/json", ...init.headers }
          : init.headers,
    });
  } catch {
    throw new ApiError(0, "Sin conexión con el servidor. Revisa tu internet.", "network");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? "Algo salió mal. Inténtalo de nuevo.",
      payload?.code,
    );
  }
  return payload as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/* -------------------------------------------------------------------------- */
/*                                    Auth                                    */
/* -------------------------------------------------------------------------- */

export async function login(credentials: LoginCredentials): Promise<User> {
  return (await post<{ user: User }>("/api/auth/login", credentials)).user;
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  return (await post<{ user: User }>("/api/auth/signup", input)).user;
}

export async function logout(): Promise<void> {
  await post("/api/auth/logout");
}

/** The signed-in user, or null. Never throws for "signed out". */
export async function getCurrentUser(): Promise<User | null> {
  return (await request<{ user: User | null }>("/api/auth/me")).user;
}

export async function updateProfile(
  patch: Partial<Pick<User, "name">> & Partial<UserPreferences>,
): Promise<User> {
  return (await request<{ user: User }>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  })).user;
}

/**
 * Password reset needs an email provider. Supabase Auth ships one, so this is
 * wired up during the migration rather than built twice.
 * TODO(auth): `supabase.auth.resetPasswordForEmail(email)`.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!/.+@.+\..+/.test(email)) throw new ApiError(400, "Escribe un correo válido.");
}

/* -------------------------------------------------------------------------- */
/*                              Plans & billing                               */
/* -------------------------------------------------------------------------- */

export async function getPricingPlans(): Promise<SubscriptionPlan[]> {
  return (await request<{ plans: SubscriptionPlan[] }>("/api/plans")).plans;
}

export async function createCheckoutSession(
  planId: SubscriptionPlan["id"],
): Promise<{ planId: string; checkoutUrl: string | null }> {
  return post("/api/billing/checkout", { planId });
}

export async function getServiceStatus(): Promise<ServiceStatus> {
  return request<ServiceStatus>("/api/status");
}

/* -------------------------------------------------------------------------- */
/*                                   Videos                                   */
/* -------------------------------------------------------------------------- */

export async function getVideos(): Promise<Video[]> {
  return (await request<{ videos: Video[] }>("/api/videos")).videos;
}

/** A video the caller owns, or null when it does not exist (or is not theirs). */
export async function getVideoById(id: string): Promise<Video | null> {
  try {
    return (await request<{ video: Video }>(`/api/videos/${encodeURIComponent(id)}`)).video;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function deleteVideo(id: string): Promise<void> {
  await request(`/api/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function regenerateVideo(id: string): Promise<Video> {
  return (await post<{ video: Video }>(`/api/videos/${encodeURIComponent(id)}/regenerate`)).video;
}

export function documentDownloadUrl(documentId: string) {
  return `/api/documents/${encodeURIComponent(documentId)}/download`;
}

export interface GenerationOptions {
  style: VideoStyle;
  durationMinutes: VideoDurationMinutes;
  prompt?: string;
}

/**
 * Uploads the document and starts generation. Uses XHR rather than fetch
 * because only XHR reports upload progress — on a 20 MB textbook that bar is
 * the difference between "working" and "frozen".
 *
 * Resolves as soon as the server has queued the video; the result arrives by
 * polling (see `lib/video-store.tsx`).
 */
export function startGeneration(
  file: File,
  options: GenerationOptions,
  onUploadProgress?: (fraction: number) => void,
): Promise<Video> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onUploadProgress?.(event.loaded / event.total);
    };

    xhr.onload = () => {
      let payload: { video?: Video; error?: string; code?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // fall through to the generic message
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.video) {
        resolve(payload.video);
      } else {
        reject(
          new ApiError(
            xhr.status,
            payload?.error ?? "No pudimos iniciar la generación.",
            payload?.code,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "Sin conexión con el servidor. Revisa tu internet.", "network"));

    const body = new FormData();
    body.set("file", file);
    body.set("style", options.style);
    body.set("durationMinutes", String(options.durationMinutes));
    if (options.prompt) body.set("prompt", options.prompt);
    xhr.send(body);
  });
}

/* -------------------------------------------------------------------------- */
/*                         Pipeline display (pure)                            */
/* -------------------------------------------------------------------------- */

const STEP_ORDER: GenerationStepId[] = [
  "uploading",
  "reading",
  "storyboarding",
  "rendering",
  "ready",
];

const STAGE_TO_STEP: Record<GenerationStage, GenerationStepId> = {
  queued: "reading",
  reading: "reading",
  storyboarding: "storyboarding",
  finalizing: "rendering",
  done: "ready",
};

export function createGenerationSteps(): GenerationStep[] {
  return generationSteps.map((step) => ({ ...step }));
}

/** The five visible steps, derived from where the server says the video is. */
export function stepsForVideo(video: Video | null, uploading: boolean): GenerationStep[] {
  const active: GenerationStepId =
    uploading || !video
      ? "uploading"
      : video.status === "ready"
        ? "ready"
        : STAGE_TO_STEP[video.stage ?? "queued"];
  const at = STEP_ORDER.indexOf(active);

  return generationSteps.map((step) => {
    const index = STEP_ORDER.indexOf(step.id);
    const state =
      video?.status === "ready"
        ? "done"
        : video?.status === "failed" && step.id === active
          ? "failed"
          : index < at
            ? "done"
            : index === at
              ? "active"
              : "pending";
    return { ...step, state };
  });
}

/** Overall progress, 0–100, for the bar above the steps. */
export function progressForVideo(video: Video | null, uploadFraction: number): number {
  if (!video) return Math.round(uploadFraction * 8);
  if (video.status === "ready") return 100;
  return video.progress ?? 8;
}
