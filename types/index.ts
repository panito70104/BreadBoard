/**
 * Domain types for BreadBoardAI.
 *
 * These are the shapes the UI renders today from mock data, and the shapes the
 * REST/tRPC backend is expected to return later. Keep them as the single source
 * of truth: `lib/api.ts` returns them, `data/mock.ts` fabricates them.
 */

import type { StoryboardScene } from "@/types/storyboard";

/* -------------------------------------------------------------------------- */
/*                                    User                                    */
/* -------------------------------------------------------------------------- */

export type PlanId = "free" | "student" | "pro";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Mock avatars are initials-based; a real backend returns a CDN URL. */
  avatarUrl?: string;
  planId: PlanId;
  createdAt: string;
  /** Usage counters drive the sidebar/billing meters. Billing is per minute. */
  minutesUsed: number;
  minutesLimit: number;
}

export interface AuthSession {
  user: User;
  /** Placeholder for the JWT / session cookie the auth provider will issue. */
  token: string;
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Document                                  */
/* -------------------------------------------------------------------------- */

export type DocumentType = "pdf" | "docx" | "txt";

/**
 * A study document uploaded by the student.
 *
 * Named `StudyDocument` so it never collides with the DOM `Document` global;
 * `Document` is exported below as an alias for readability.
 */
export interface StudyDocument {
  id: string;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  pageCount?: number;
  uploadedAt: string;
  /** Object key in S3/R2 once storage is wired up. */
  storageKey?: string;
}

export type Document = StudyDocument;

/* -------------------------------------------------------------------------- */
/*                                 Generation                                 */
/* -------------------------------------------------------------------------- */

/** Every state the generation pipeline can be in, in pipeline order. */
export type GenerationStatus =
  | "idle"
  | "uploading"
  | "reading"
  | "storyboarding"
  | "rendering"
  | "ready"
  | "failed";

/** The five steps surfaced to the user while a video is being produced. */
export type GenerationStepId = Exclude<GenerationStatus, "idle" | "failed">;

export type GenerationStepState = "pending" | "active" | "done" | "failed";

export interface GenerationStep {
  id: GenerationStepId;
  label: string;
  description: string;
  state: GenerationStepState;
}

export type VideoStyle = "classic-whiteboard" | "paper-desk" | "color-markers";

export type VideoDurationMinutes = 1 | 3 | 5;

export interface VideoStyleOption {
  id: VideoStyle;
  label: string;
  description: string;
  /** Swatch colors used by the style picker preview. */
  swatch: [string, string, string];
}

export interface VideoDurationOption {
  id: VideoDurationMinutes;
  label: string;
  description: string;
}

/** Payload sent to `POST /generation-jobs` once the backend exists. */
export interface GenerationJobInput {
  documentId: string;
  /** Free-form request: "Explícame el capítulo 1 de forma sencilla". */
  prompt?: string;
  style: VideoStyle;
  durationMinutes: VideoDurationMinutes;
}

export interface GenerationJob {
  id: string;
  documentId: string;
  status: GenerationStatus;
  /** 0–100, drives the progress bar. */
  progress: number;
  steps: GenerationStep[];
  videoId?: string;
  error?: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/*                                 Storyboard                                 */
/* -------------------------------------------------------------------------- */

/**
 * The storyboard is the contract between OpenAI and the Remotion engine, so it
 * lives in its own module. Re-exported here because the rest of the app reads
 * its domain types from `@/types`.
 *
 * @see `types/storyboard.ts` for the shape and `lib/storyboard/` for the
 * validator, the layouts and the prompt that produces it.
 */
export type {
  ArrowElement,
  BulletElement,
  BulletMarker,
  DiagramElement,
  DiagramKind,
  DrawElement,
  DrawElementType,
  ElementTarget,
  EmphasisElement,
  EmphasisShape,
  EraseElement,
  FormulaElement,
  IconElement,
  LayoutDefinition,
  MarkColor,
  SceneLayout,
  Slot,
  SlotBox,
  Storyboard,
  StoryboardParseResult,
  StoryboardScene,
  StoryboardStep,
  StoryboardWarning,
  StoryboardWarningCode,
  TextElement,
  TextSize,
  TitleElement,
} from "@/types/storyboard";

/* -------------------------------------------------------------------------- */
/*                                   Video                                    */
/* -------------------------------------------------------------------------- */

export type VideoStatus = "ready" | "generating" | "failed";

export interface Video {
  id: string;
  title: string;
  status: VideoStatus;
  createdAt: string;
  durationSeconds: number;
  style: VideoStyle;
  sourceDocument: StudyDocument;
  storyboard: StoryboardScene[];
  prompt?: string;
  /** Mock thumbnails are generated gradients; real ones are CDN URLs. */
  thumbnailUrl?: string;
  /** Signed playback URL once rendering is wired up. */
  videoUrl?: string;
  /** Present while `status === "generating"`. */
  progress?: number;
  /** Present when `status === "failed"`. */
  error?: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Billing                                   */
/* -------------------------------------------------------------------------- */

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in the plan currency. `0` means free. */
  price: number;
  currency: "USD";
  interval: "month";
  /** Minutes of rendered video included per month — the billing unit. */
  minutesPerMonth: number;
  /** Cap on the length of a single video. */
  maxDurationMinutes: VideoDurationMinutes;
  features: PlanFeature[];
  ctaLabel: string;
  highlighted?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               API primitives                               */
/* -------------------------------------------------------------------------- */

/** Envelope every mock call returns, mirroring the planned REST responses. */
export interface ApiResult<T> {
  data: T;
}

export interface ApiError {
  message: string;
  code?: string;
}
