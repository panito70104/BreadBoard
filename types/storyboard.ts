/**
 * The storyboard contract.
 *
 * This is the single artifact that OpenAI produces and that the Remotion engine
 * consumes. Everything else hangs off it: the prompt is generated from these
 * definitions, the validator repairs model output into this shape, and the
 * renderer only ever reads it.
 *
 * Two rules shape the whole design:
 *
 * 1. **The model never picks coordinates.** It picks a `layout` and drops
 *    elements into named `slot`s. The engine owns the geometry, so a scene is
 *    always composed even when the model is sloppy.
 * 2. **The model never picks timestamps.** Each step declares `on`: the exact
 *    phrase of the narration it belongs to. The engine matches that phrase
 *    against the TTS word timings and fires the drawing there.
 */

/* -------------------------------------------------------------------------- */
/*                                   Layout                                   */
/* -------------------------------------------------------------------------- */

/** Named regions of the board. Which ones exist depends on the layout. */
export type Slot =
  | "title"
  | "visual"
  | "list"
  | "left"
  | "right"
  | "center"
  | "aside"
  | "footer";

export type SceneLayout =
  | "title-only"
  | "title-bullets"
  | "visual-left-bullets-right"
  | "two-column-compare"
  | "center-diagram-labels"
  | "timeline"
  | "formula-steps"
  | "summary-box";

/** Slot geometry, normalized to the board (0–1 on both axes, 16:9). */
export interface SlotBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutDefinition {
  id: SceneLayout;
  label: string;
  /** Written for the model: when this layout is the right choice. */
  description: string;
  slots: Partial<Record<Slot, SlotBox>>;
  /** Where elements go when the model asks for a slot this layout lacks. */
  fallbackSlot: Slot;
}

/* -------------------------------------------------------------------------- */
/*                                  Elements                                  */
/* -------------------------------------------------------------------------- */

/** Marker colors, mirroring the design tokens in `app/globals.css`. */
export type MarkColor = "ink" | "brand" | "amber" | "red" | "green" | "blue";

export type TextSize = "sm" | "md" | "lg";

export type BulletMarker = "dot" | "dash" | "check" | "number" | "arrow" | "star";

export type EmphasisShape = "underline" | "box" | "circle" | "brace" | "strike";

export type DiagramKind = "axes" | "timeline" | "flow" | "compare" | "cycle" | "tree";

/** What an emphasis wraps: a slot, or whatever was drawn immediately before. */
export type ElementTarget = Slot | "prev";

export interface TitleElement {
  type: "title";
  text: string;
}

export interface TextElement {
  type: "text";
  slot: Slot;
  text: string;
  size?: TextSize;
  color?: MarkColor;
}

/** One bullet per step, so each line lands on its own narration phrase. */
export interface BulletElement {
  type: "bullet";
  slot: Slot;
  text: string;
  marker?: BulletMarker;
  color?: MarkColor;
}

export interface IconElement {
  type: "icon";
  slot: Slot;
  /** A name from the curated vocabulary in `lib/storyboard/icons.ts`. */
  id: string;
  /** Multiplier on the slot-derived base size. */
  scale?: number;
  color?: MarkColor;
}

export interface ArrowElement {
  type: "arrow";
  from: Slot;
  to: Slot;
  curve?: "straight" | "arc";
  color?: MarkColor;
}

export interface EmphasisElement {
  type: "emphasis";
  shape: EmphasisShape;
  target: ElementTarget;
  color?: MarkColor;
}

export interface DiagramElement {
  type: "diagram";
  slot: Slot;
  kind: DiagramKind;
  /** Node/axis/step labels, in order. The engine lays them out. */
  labels: string[];
}

export interface FormulaElement {
  type: "formula";
  slot: Slot;
  /** Plain-text rendering, always required — it is what gets drawn. */
  text: string;
  /** Optional LaTeX for a future typeset pass. */
  latex?: string;
}

/** Wipes the board (or one slot) so a long video can keep going. */
export interface EraseElement {
  type: "erase";
  scope: "board" | Slot;
}

export type DrawElement =
  | TitleElement
  | TextElement
  | BulletElement
  | IconElement
  | ArrowElement
  | EmphasisElement
  | DiagramElement
  | FormulaElement
  | EraseElement;

export type DrawElementType = DrawElement["type"];

/* -------------------------------------------------------------------------- */
/*                                   Scenes                                   */
/* -------------------------------------------------------------------------- */

export interface StoryboardStep {
  /**
   * Verbatim phrase from this scene's narration that triggers the drawing.
   * `null` after repair when the phrase could not be found — the engine then
   * spaces the step out proportionally instead.
   */
  on: string | null;
  draw: DrawElement;
}

export interface StoryboardScene {
  id: string;
  /** 1-based position in the video. */
  index: number;
  title: string;
  /** One line describing the scene, shown in the UI. */
  summary: string;
  /** The full line the voice-over reads. */
  narration: string;
  layout: SceneLayout;
  steps: StoryboardStep[];
  durationSeconds: number;
}

export interface Storyboard {
  videoTitle: string;
  scenes: StoryboardScene[];
  totalSeconds: number;
}

/* -------------------------------------------------------------------------- */
/*                                 Validation                                 */
/* -------------------------------------------------------------------------- */

export type StoryboardWarningCode =
  | "unknown-layout"
  | "unknown-slot"
  | "unknown-icon"
  | "phrase-not-in-narration"
  | "empty-scene"
  | "too-many-steps"
  | "slot-overflow"
  | "dangling-emphasis"
  | "text-truncated"
  | "duration-estimated"
  | "scene-dropped";

/** What the validator had to fix. Log these: they are prompt-quality signal. */
export interface StoryboardWarning {
  code: StoryboardWarningCode;
  message: string;
  sceneIndex?: number;
  stepIndex?: number;
}

export interface StoryboardParseResult {
  storyboard: Storyboard;
  warnings: StoryboardWarning[];
  /** True when the model's output needed no repair at all. */
  clean: boolean;
}
