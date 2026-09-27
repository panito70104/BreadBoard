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
  /** Full usage picture, present when the server sends it. */
  usage?: UsageInfo;
  preferences?: UserPreferences;
}

export interface UsageInfo {
  planId: PlanId;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  maxVideoMinutes: number;
  periodStart: string;
  periodEnd: string;
}

export interface UserPreferences {
  defaultStyle: VideoStyle;
  defaultDurationMinutes: VideoDurationMinutes;
}

/** What the server can do right now — shown before the student commits. */
export interface ServiceStatus {
  storyboardProvider: "claude" | "mock";
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

/** Where the server-side pipeline is while a video is generating. */
export type GenerationStage =
  | "queued"
  | "reading"
  | "storyboarding"
  | "voicing"
  | "finalizing"
  | "done";

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
  /**
   * Where to fetch each scene's voice-over, by scene id. Missing entries are
   * scenes that came out silent; an empty object is a video with no voice.
   */
  audioUrls?: Record<string, string>;
  /** Present while `status === "generating"`. */
  progress?: number;
  /** Present when `status === "failed"`. */
  error?: string;
  /** Pipeline position while generating. */
  stage?: GenerationStage;
  /**
   * Minutes this video costs. A hold of the worst case while it generates,
   * settled down to what it really came out at once it is ready.
   */
  requestedMinutes?: number;
  /** Who wrote the storyboard: Claude, or the sample template. */
  source?: "claude" | "mock";
  /** Language of the narration and of everything written on the board. */
  language?: string;
  /** Worth telling the student, not an error (e.g. only part of a book was read). */
  notice?: string;
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
