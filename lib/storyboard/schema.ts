/**
 * Storyboard validation and repair.
 *
 * The model will get things wrong: a layout that does not exist, a slot the
 * layout does not have, an icon outside the vocabulary, a trigger phrase that
 * drifted from the narration it was supposed to quote. None of that should
 * fail a render.
 *
 * So parsing is permissive and everything is repaired into a renderable
 * `Storyboard`, with a warning per fix. Log the warnings — they are the
 * clearest signal of how well the prompt is doing on real documents.
 */

import { z } from "zod";

import {
  DEFAULT_LAYOUT,
  bulletCapacity,
  hasSlot,
  isSceneLayout,
  LAYOUTS,
  LAYOUT_IDS,
} from "@/lib/storyboard/layouts";
import { FALLBACK_ICON, ICON_IDS, resolveIconId } from "@/lib/storyboard/icons";
import type {
  DrawElement,
  DrawElementType,
  MarkColor,
  SceneLayout,
  Slot,
  Storyboard,
  StoryboardParseResult,
  StoryboardScene,
  StoryboardStep,
  StoryboardWarning,
  StoryboardWarningCode,
} from "@/types/storyboard";

/* -------------------------------------------------------------------------- */
/*                                   Limits                                   */
/* -------------------------------------------------------------------------- */

export const LIMITS = {
  titleChars: 60,
  bulletChars: 70,
  textChars: 140,
  formulaChars: 120,
  labelChars: 40,
  maxLabels: 8,
  maxStepsPerScene: 14,
  maxScenes: 12,
  /** Spanish narration at a teaching pace. */
  wordsPerSecond: 2.4,
  minSceneSeconds: 6,
  maxSceneSeconds: 120,
} as const;

const ELEMENT_TYPES = [
  "title",
  "text",
  "bullet",
  "icon",
  "arrow",
  "emphasis",
  "diagram",
  "formula",
  "erase",
] as const satisfies readonly DrawElementType[];

const MARK_COLORS: MarkColor[] = ["ink", "brand", "amber", "red", "green", "blue"];
const TEXT_SIZES = ["sm", "md", "lg"] as const;
const BULLET_MARKERS = ["dot", "dash", "check", "number", "arrow", "star"] as const;
const EMPHASIS_SHAPES = ["underline", "box", "circle", "brace", "strike"] as const;
const DIAGRAM_KINDS = ["axes", "timeline", "flow", "compare", "cycle", "tree"] as const;
const SLOTS: Slot[] = [
  "title",
  "visual",
  "list",
  "left",
  "right",
  "center",
  "aside",
  "footer",
];

/* -------------------------------------------------------------------------- */
/*                              Permissive schema                             */
/* -------------------------------------------------------------------------- */

/**
 * Shape-only gate. It checks that the payload is structurally a storyboard and
 * nothing more — every semantic decision belongs to the repair pass, which can
 * fix things instead of rejecting them.
 */
const rawStepSchema = z.object({
  on: z.union([z.string(), z.null()]).optional(),
  draw: z.record(z.string(), z.unknown()),
});

const rawSceneSchema = z.object({
  id: z.string().optional(),
  index: z.number().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  narration: z.string().optional(),
  layout: z.string().optional(),
  steps: z.array(rawStepSchema).optional(),
  durationSeconds: z.number().optional(),
});

export const rawStoryboardSchema = z.object({
  videoTitle: z.string().optional(),
  scenes: z.array(rawSceneSchema),
});

/* -------------------------------------------------------------------------- */
/*                         Strict schema (model output)                       */
/* -------------------------------------------------------------------------- */

/**
 * The shape Claude is constrained to produce, via structured outputs.
 *
 * This is the opposite of the permissive schema above, and they do different
 * jobs: this one removes *syntax* errors (a layout that is not a layout, an
 * icon outside the vocabulary, a misspelled element type) because the model
 * literally cannot emit them. `parseStoryboard` still runs afterwards for the
 * *semantic* errors no JSON Schema can express — a slot the chosen layout does
 * not have, a trigger phrase absent from the narration, six bullets where four
 * fit.
 *
 * Every field is required; optional ones are nullable instead, which is what
 * strict structured outputs accept.
 */
const asEnum = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

const slotEnum = asEnum(SLOTS);
const colorEnum = asEnum(MARK_COLORS).nullable();

const strictElementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), text: z.string() }),
  z.object({
    type: z.literal("text"),
    slot: slotEnum,
    text: z.string(),
    size: asEnum(TEXT_SIZES).nullable(),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("bullet"),
    slot: slotEnum,
    text: z.string(),
    marker: asEnum(BULLET_MARKERS).nullable(),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("icon"),
    slot: slotEnum,
    id: asEnum(ICON_IDS),
    scale: z.number().nullable(),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("arrow"),
    from: slotEnum,
    to: slotEnum,
    curve: asEnum(["straight", "arc"]).nullable(),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("emphasis"),
    shape: asEnum(EMPHASIS_SHAPES),
    target: asEnum([...SLOTS, "prev"]),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("diagram"),
    slot: slotEnum,
    kind: asEnum(DIAGRAM_KINDS),
    labels: z.array(z.string()),
  }),
  z.object({
    type: z.literal("formula"),
    slot: slotEnum,
    text: z.string(),
    latex: z.string().nullable(),
  }),
  z.object({ type: z.literal("erase"), scope: asEnum([...SLOTS, "board"]) }),
]);

export const strictStoryboardSchema = z.object({
  videoTitle: z.string(),
  scenes: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      narration: z.string(),
      layout: asEnum(LAYOUT_IDS),
      durationSeconds: z.number(),
      steps: z.array(
        z.object({
          /** Verbatim phrase from this scene's narration. */
          on: z.string(),
          draw: strictElementSchema,
        }),
      ),
    }),
  ),
});

export class StoryboardParseError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[] = []) {
    super(message);
    this.name = "StoryboardParseError";
    this.issues = issues;
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function collapse(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Lowercase, unaccented, punctuation-free — for matching trigger phrases. */
function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function estimateSeconds(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  const seconds = Math.round(words / LIMITS.wordsPerSecond);
  return Math.min(
    LIMITS.maxSceneSeconds,
    Math.max(LIMITS.minSceneSeconds, seconds || LIMITS.minSceneSeconds),
  );
}

export interface ParseStoryboardOptions {
  /**
   * What to do with an icon outside the vocabulary.
   * `"fallback"` keeps the drawing with a generic icon so the slot is not left
   * empty; `"drop"` removes it, which is safer when a wrong picture would
   * mislead. Either way the requested id lands in the warnings.
   */
  onUnknownIcon?: "fallback" | "drop";
  /** Title used when the model omits one. */
  fallbackTitle?: string;
}

/* -------------------------------------------------------------------------- */
/*                                   Repair                                   */
/* -------------------------------------------------------------------------- */

export function parseStoryboard(
  input: unknown,
  options: ParseStoryboardOptions = {},
): StoryboardParseResult {
  const { onUnknownIcon = "fallback", fallbackTitle = "Video sin título" } = options;

  const payload =
    typeof input === "string" ? safeJsonParse(input) : (input as unknown);

  const parsed = rawStoryboardSchema.safeParse(payload);
  if (!parsed.success) {
    throw new StoryboardParseError(
      "La respuesta del modelo no tiene forma de storyboard.",
      parsed.error.issues,
    );
  }

  const warnings: StoryboardWarning[] = [];
  const warn = (
    code: StoryboardWarningCode,
    message: string,
    sceneIndex?: number,
    stepIndex?: number,
  ) => warnings.push({ code, message, sceneIndex, stepIndex });

  const rawScenes = parsed.data.scenes.slice(0, LIMITS.maxScenes);
  if (parsed.data.scenes.length > LIMITS.maxScenes) {
    warn(
      "scene-dropped",
      `El modelo devolvió ${parsed.data.scenes.length} escenas; se conservaron ${LIMITS.maxScenes}.`,
    );
  }

  const scenes: StoryboardScene[] = [];

  rawScenes.forEach((rawScene, position) => {
    const sceneIndex = scenes.length + 1;

    const layout: SceneLayout = isSceneLayout(rawScene.layout)
      ? rawScene.layout
      : DEFAULT_LAYOUT;
    if (!isSceneLayout(rawScene.layout)) {
      warn(
        "unknown-layout",
        `Layout "${rawScene.layout ?? "(vacío)"}" no existe; se usó "${DEFAULT_LAYOUT}".`,
        sceneIndex,
      );
    }

    const title = collapse(rawScene.title).slice(0, LIMITS.titleChars);
    const narration = collapse(rawScene.narration);
    const summary = collapse(rawScene.summary) || title || narration.slice(0, 120);
    const narrationMatch = normalizeForMatch(narration);

    const steps: StoryboardStep[] = [];
    const bulletsPerSlot = new Map<Slot, number>();

    const rawSteps = rawScene.steps ?? [];
    for (const [stepIndex, rawStep] of rawSteps.entries()) {
      if (steps.length >= LIMITS.maxStepsPerScene) {
        warn(
          "too-many-steps",
          `La escena traía ${rawSteps.length} pasos; se conservaron ${LIMITS.maxStepsPerScene}.`,
          sceneIndex,
        );
        break;
      }

      const draw = normalizeElement(rawStep.draw, {
        layout,
        sceneIndex,
        stepIndex,
        hasPrevious: steps.length > 0,
        bulletsPerSlot,
        onUnknownIcon,
        warn,
      });
      if (!draw) continue;

      let on: string | null = null;
      const phrase = collapse(rawStep.on);
      if (phrase) {
        if (narrationMatch.includes(normalizeForMatch(phrase))) {
          on = phrase;
        } else {
          warn(
            "phrase-not-in-narration",
            `La frase "${phrase}" no aparece en la narración; el paso se repartirá por tiempo.`,
            sceneIndex,
            stepIndex,
          );
        }
      }

      steps.push({ on, draw });
    }

    if (steps.length === 0) {
      if (!title && !narration) {
        warn("scene-dropped", "Escena sin título ni narración; se descartó.", sceneIndex);
        return;
      }
      steps.push({ on: null, draw: { type: "title", text: title || summary } });
      warn(
        "empty-scene",
        "La escena no traía pasos dibujables; se generó solo el título.",
        sceneIndex,
      );
    }

    let durationSeconds = rawScene.durationSeconds ?? 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      durationSeconds = estimateSeconds(narration);
      warn(
        "duration-estimated",
        `Duración ausente o inválida; se estimó en ${durationSeconds}s desde la narración.`,
        sceneIndex,
      );
    }
    durationSeconds = Math.min(
      LIMITS.maxSceneSeconds,
      Math.max(LIMITS.minSceneSeconds, Math.round(durationSeconds)),
    );

    scenes.push({
      id: rawScene.id?.trim() || `scene_${sceneIndex}`,
      index: sceneIndex,
      title: title || `Escena ${sceneIndex}`,
      summary,
      narration,
      layout,
      steps,
      durationSeconds,
    });

    void position;
  });

  const storyboard: Storyboard = {
    videoTitle: collapse(parsed.data.videoTitle) || fallbackTitle,
    scenes,
    totalSeconds: scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
  };

  return { storyboard, warnings, clean: warnings.length === 0 };
}

function safeJsonParse(value: string): unknown {
  // Models like to wrap JSON in ```json fences.
  const unfenced = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    throw new StoryboardParseError("La respuesta del modelo no es JSON válido.");
  }
}

/* -------------------------------------------------------------------------- */
/*                             Element normalizing                            */
/* -------------------------------------------------------------------------- */

interface NormalizeContext {
  layout: SceneLayout;
  sceneIndex: number;
  stepIndex: number;
  hasPrevious: boolean;
  bulletsPerSlot: Map<Slot, number>;
  onUnknownIcon: "fallback" | "drop";
  warn: (
    code: StoryboardWarningCode,
    message: string,
    sceneIndex?: number,
    stepIndex?: number,
  ) => void;
}

function normalizeElement(
  raw: Record<string, unknown>,
  context: NormalizeContext,
): DrawElement | null {
  const { layout, sceneIndex, stepIndex, warn } = context;

  const type = pick(raw.type, ELEMENT_TYPES);
  if (!type) {
    warn(
      "unknown-slot",
      `Tipo de elemento "${String(raw.type)}" desconocido; el paso se descartó.`,
      sceneIndex,
      stepIndex,
    );
    return null;
  }

  const color = pick(raw.color, MARK_COLORS);

  /** Resolve a slot against the layout, warning when it has to be remapped. */
  const slotOf = (value: unknown, fieldName = "slot"): Slot => {
    const requested = pick(value, SLOTS);
    if (requested && hasSlot(layout, requested)) return requested;

    const fallback = LAYOUTS[layout].fallbackSlot;
    warn(
      "unknown-slot",
      `El layout "${layout}" no tiene ${fieldName} "${String(value)}"; se usó "${fallback}".`,
      sceneIndex,
      stepIndex,
    );
    return fallback;
  };

  const textOf = (value: unknown, limit: number): string => {
    const text = collapse(value);
    if (text.length <= limit) return text;
    warn(
      "text-truncated",
      `Texto recortado a ${limit} caracteres: "${text.slice(0, 40)}…".`,
      sceneIndex,
      stepIndex,
    );
    return text.slice(0, limit).trimEnd();
  };

  switch (type) {
    case "title": {
      const text = textOf(raw.text, LIMITS.titleChars);
      return text ? { type: "title", text } : null;
    }

    case "text": {
      const text = textOf(raw.text, LIMITS.textChars);
      if (!text) return null;
      return {
        type: "text",
        slot: slotOf(raw.slot),
        text,
        size: pick(raw.size, TEXT_SIZES),
        color,
      };
    }

    case "bullet": {
      const text = textOf(raw.text, LIMITS.bulletChars);
      if (!text) return null;

      const slot = slotOf(raw.slot);
      const used = context.bulletsPerSlot.get(slot) ?? 0;
      const capacity = bulletCapacity(layout, slot);
      if (used >= capacity) {
        warn(
          "slot-overflow",
          `"${slot}" solo admite ${capacity} viñetas legibles; se descartó "${text}".`,
          sceneIndex,
          stepIndex,
        );
        return null;
      }
      context.bulletsPerSlot.set(slot, used + 1);

      return {
        type: "bullet",
        slot,
        text,
        marker: pick(raw.marker, BULLET_MARKERS),
        color,
      };
    }

    case "icon": {
      const requested = typeof raw.id === "string" ? raw.id : "";
      const resolved = requested ? resolveIconId(requested) : null;

      if (!resolved) {
        warn(
          "unknown-icon",
          `El icono "${requested || "(vacío)"}" no está en el vocabulario.`,
          sceneIndex,
          stepIndex,
        );
        if (context.onUnknownIcon === "drop") return null;
      }

      const scale = typeof raw.scale === "number" && raw.scale > 0 ? raw.scale : undefined;
      return {
        type: "icon",
        slot: slotOf(raw.slot),
        id: resolved ?? FALLBACK_ICON,
        scale: scale ? Math.min(2, Math.max(0.4, scale)) : undefined,
        color,
      };
    }

    case "arrow":
      return {
        type: "arrow",
        from: slotOf(raw.from, "from"),
        to: slotOf(raw.to, "to"),
        curve: pick(raw.curve, ["straight", "arc"] as const),
        color,
      };

    case "emphasis": {
      const shape = pick(raw.shape, EMPHASIS_SHAPES) ?? "underline";

      if (raw.target === "prev") {
        if (!context.hasPrevious) {
          warn(
            "dangling-emphasis",
            'Un énfasis apuntaba a "prev" siendo el primer paso; se descartó.',
            sceneIndex,
            stepIndex,
          );
          return null;
        }
        return { type: "emphasis", shape, target: "prev", color };
      }

      return { type: "emphasis", shape, target: slotOf(raw.target, "target"), color };
    }

    case "diagram": {
      const rawLabels = Array.isArray(raw.labels) ? raw.labels : [];
      const labels = rawLabels
        .map((label) => textOf(label, LIMITS.labelChars))
        .filter(Boolean)
        .slice(0, LIMITS.maxLabels);

      if (labels.length === 0) {
        warn("empty-scene", "Diagrama sin etiquetas; se descartó.", sceneIndex, stepIndex);
        return null;
      }
      if (rawLabels.length > LIMITS.maxLabels) {
        warn(
          "slot-overflow",
          `El diagrama traía ${rawLabels.length} etiquetas; se conservaron ${LIMITS.maxLabels}.`,
          sceneIndex,
          stepIndex,
        );
      }

      return {
        type: "diagram",
        slot: slotOf(raw.slot),
        kind: pick(raw.kind, DIAGRAM_KINDS) ?? "flow",
        labels,
      };
    }

    case "formula": {
      const text = textOf(raw.text, LIMITS.formulaChars);
      if (!text) return null;
      return {
        type: "formula",
        slot: slotOf(raw.slot),
        text,
        latex: typeof raw.latex === "string" ? raw.latex.trim() : undefined,
      };
    }

    case "erase":
      return {
        type: "erase",
        scope: raw.scope === "board" ? "board" : slotOf(raw.scope, "scope"),
      };
  }
}
