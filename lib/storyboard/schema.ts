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
import { FALLBACK_ICON, resolveIconId } from "@/lib/storyboard/icons";
import { normalizeForMatch } from "@/lib/storyboard/normalize";
import type {
  DrawElement,
  DrawElementType,
  MarkColor,
  SceneLayout,
  SketchItem,
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
  bulletChars: 56,
  textChars: 110,
  formulaChars: 120,
  labelChars: 40,
  /** Enough for a three-column table with four rows. */
  maxLabels: 12,
  maxStepsPerScene: 14,
  maxScenes: 12,
  /**
   * The point of the video is the drawing. Bullets are captions for it, so a
   * scene gets three and no more — past that the board is a slide, and the
   * model will always take the easy road if the road is open.
   */
  maxBulletsPerScene: 3,
  maxSketchItems: 4,
  sketchLabelChars: 24,
  captionChars: 60,
  /**
   * How fast the voice actually reads, measured: 2.57 words a second in
   * Spanish on `eleven_multilingual_v2` at its default pace. Used to guess how
   * long a scene will run before it has been spoken.
   */
  wordsPerSecond: 2.57,
  /**
   * How many words a second to *ask* the model for, which is deliberately more.
   *
   * Told to write at most N words it comes back around 86% of N — measured, and
   * stable enough to correct for. Asking for 2.8 a second lands a minute of
   * narration on about a minute of speech. `[voice]` logs the real ratio on
   * every generation; if it drifts, this is the number to move.
   *
   * Erring low is the cheap mistake: a short narration is padded with drawing
   * time for free, while a long one has to be read faster.
   */
  wordBudgetPerSecond: 2.8,
  minSceneSeconds: 6,
  maxSceneSeconds: 120,
  /**
   * The lengths a video may be, in seconds.
   *
   * A menu rather than a free number: each option is offered to the model with
   * the word budget that fits it, which is what keeps the narration landing on
   * the length it chose. Capped per request by what the plan allows.
   */
  videoLengths: [45, 60, 90, 120, 180, 240, 300],
  minVideoSeconds: 45,
} as const;

const ELEMENT_TYPES = [
  "title",
  "text",
  "bullet",
  "icon",
  "sketch",
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
const DIAGRAM_KINDS = [
  "axes",
  "bars",
  "table",
  "timeline",
  "flow",
  "compare",
  "cycle",
  "tree",
] as const;
const SKETCH_MARKS = ["cross", "check", "question"] as const;
const SKETCH_RELATIONS = ["arrow", "plus", "equals", "vs", "none"] as const;
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
  language: z.string().optional(),
  scenes: z.array(rawSceneSchema),
});

/* -------------------------------------------------------------------------- */
/*                         Strict schema (model output)                       */
/* -------------------------------------------------------------------------- */

/**
 * The shape Claude is constrained to produce, via structured outputs.
 *
 * **This union is at its size limit.** Structured outputs compile the schema
 * into a decoding grammar, and past a certain size the API refuses the request
 * outright: `400 invalid_request_error`, "The compiled grammar is too large".
 * Measured against the real API, nine ordinary branches fit; `sketch`, whose
 * `items` is an array of objects, costs about two of them. So this union holds
 * eight branches and `text` and `arrow` are not among them — a loose sentence
 * is a bullet without a marker, and a relation between two pictures is what
 * `sketch` draws, better than an arrow between two slot boxes ever did.
 *
 * Both are still whole elements everywhere else: the engine draws them and
 * `parseStoryboard` repairs them, so storyboards that already contain them
 * still render. They are only off the menu the model orders from. If you add a
 * branch here, add it against a real request — nothing local catches this.
 *
 * This is the opposite of the permissive schema above, and they do different
 * jobs: this one removes *syntax* errors (a layout that is not a layout, an
 * misspelled element type) because the model literally cannot emit them. Icon
 * names are the exception — see `iconName` below. `parseStoryboard` still runs afterwards for the
 * *semantic* errors no JSON Schema can express — a slot the chosen layout does
 * not have, a trigger phrase absent from the narration, six bullets where four
 * fit.
 *
 * Every field is required; optional ones are nullable instead, which is what
 * strict structured outputs accept.
 */
const asEnum = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

/**
 * Icon names go over as a plain string, not an enum.
 *
 * Structured outputs compile the schema into a decoding grammar, and a
 * few-hundred-alternative enum referenced from two places inside a ten-branch
 * union compiles to one large enough that the API rejects the request outright:
 * "The compiled grammar is too large". The vocabulary is listed in the system
 * prompt, `resolveIconId` catches near misses, and an icon that is still
 * unknown after that is repaired and reported — which is the repair pass doing
 * exactly the job it exists for.
 */
const iconName = z
  .string()
  .describe("Un nombre del vocabulario de iconos listado en las instrucciones.");

const slotEnum = asEnum(SLOTS);
const colorEnum = asEnum(MARK_COLORS).nullable();

const strictElementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), text: z.string() }),
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
    id: iconName,
    scale: z.number().nullable(),
    color: colorEnum,
  }),
  z.object({
    type: z.literal("sketch"),
    slot: slotEnum,
    items: z.array(
      z.object({
        icon: iconName,
        label: z.string().nullable(),
        mark: asEnum(SKETCH_MARKS).nullable(),
        color: colorEnum,
      }),
    ),
    relation: asEnum(SKETCH_RELATIONS).nullable(),
    caption: z.string().nullable(),
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
    values: z.array(z.number()).nullable(),
    columns: z.number().nullable(),
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
  /** Base language subtag: "es", "en", "pt"… */
  language: z.string(),
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

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * A base language subtag, or Spanish.
 *
 * The model is asked for "es" or "en" and mostly obliges, but it also says
 * "es-MX", "Spanish" and "español". Anything unrecognizable falls back rather
 * than reaching ElevenLabs as a voice nobody has.
 */
const LANGUAGE_NAMES: Record<string, string> = {
  espanol: "es",
  spanish: "es",
  castellano: "es",
  english: "en",
  ingles: "en",
  portugues: "pt",
  portuguese: "pt",
  frances: "fr",
  french: "fr",
  aleman: "de",
  german: "de",
  italiano: "it",
  italian: "it",
};

export const DEFAULT_LANGUAGE = "es";

export function normalizeLanguage(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return DEFAULT_LANGUAGE;

  const named = LANGUAGE_NAMES[normalizeForMatch(raw)];
  if (named) return named;

  const subtag = raw.toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(subtag) ? subtag : DEFAULT_LANGUAGE;
}

function estimateSeconds(narration: string): number {
  const words = narration.split(/\s+/).filter(Boolean).length;
  const seconds = Math.round(words / LIMITS.wordsPerSecond);
  return Math.min(
    LIMITS.maxSceneSeconds,
    Math.max(LIMITS.minSceneSeconds, seconds || LIMITS.minSceneSeconds),
  );
}

/**
 * How long the model asked for, clamped to what it was allowed to ask for.
 *
 * There is deliberately no `targetSeconds` field in the strict schema. The
 * model already declares a length for every scene, so the total is their sum —
 * one source of truth instead of two that can disagree. It is also the only
 * version that fits: structured outputs compile the schema into a decoding
 * grammar, and adding a single top-level number to this union was enough to
 * blow its size limit outright. A number is expensive in a grammar; the scene
 * durations were already being paid for.
 */
export function normalizeTargetSeconds(scenes: { durationSeconds: number }[], allowedSeconds: number): number {
  const ceiling = Math.max(LIMITS.minVideoSeconds, Math.round(allowedSeconds));
  const asked = Math.round(scenes.reduce((total, scene) => total + scene.durationSeconds, 0));
  if (asked <= 0) return Math.min(ceiling, 60);
  return Math.min(ceiling, Math.max(LIMITS.minVideoSeconds, asked));
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
  /** The longest video this request was allowed to produce, in seconds. */
  allowedSeconds?: number;
}

/* -------------------------------------------------------------------------- */
/*                                   Repair                                   */
/* -------------------------------------------------------------------------- */

export function parseStoryboard(
  input: unknown,
  options: ParseStoryboardOptions = {},
): StoryboardParseResult {
  const {
    onUnknownIcon = "fallback",
    fallbackTitle = "Video sin título",
    allowedSeconds = 300,
  } = options;

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
    // What this scene is made of, so a wall of text can be caught and capped.
    const tally: SceneTally = { bullets: 0, written: 0, drawings: 0 };

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
        tally,
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

    if (tally.drawings === 0 && tally.written > 0) {
      warn(
        "text-heavy",
        "La escena no dibuja nada: solo escribe. Un video de pizarra que solo escribe es una diapositiva.",
        sceneIndex,
      );
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
    language: normalizeLanguage(parsed.data.language),
    targetSeconds: normalizeTargetSeconds(scenes, allowedSeconds),
    scenes,
    totalSeconds: scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
  };

  return { storyboard, warnings, clean: warnings.length === 0 };
}

/* -------------------------------------------------------------------------- */
/*                               Drawing balance                              */
/* -------------------------------------------------------------------------- */

export interface VisualHealth {
  scenes: number;
  /** Scenes with at least one icon, sketch or diagram in them. */
  drawn: number;
  drawings: number;
  /** Bullets and loose sentences, across the whole video. */
  written: number;
  ok: boolean;
}

/**
 * Is this a whiteboard video, or a deck with a hand in front of it?
 *
 * The prompt asks for drawings, and the repair pass caps how much text a scene
 * can hold, but neither can make a model draw. This is the measurement that
 * says whether it did — which is what `generate.ts` retries on and what is
 * worth logging over real documents.
 */
export function visualHealth(storyboard: Storyboard): VisualHealth {
  let drawn = 0;
  let drawings = 0;
  let written = 0;

  for (const scene of storyboard.scenes) {
    let here = 0;
    for (const { draw } of scene.steps) {
      if (draw.type === "icon" || draw.type === "sketch" || draw.type === "diagram") {
        here += 1;
      } else if (draw.type === "bullet" || draw.type === "text") {
        written += 1;
      }
    }
    drawings += here;
    if (here > 0) drawn += 1;
  }

  const scenes = storyboard.scenes.length;
  return {
    scenes,
    drawn,
    drawings,
    written,
    // Almost every scene has to show something, and across the video there
    // should be at least as much drawn as there is written.
    ok: scenes === 0 || (drawn >= Math.ceil(scenes * 0.8) && drawings >= written),
  };
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

/** Running count of what a scene puts on the board. */
interface SceneTally {
  bullets: number;
  /** Bullets and loose sentences: everything the viewer has to read. */
  written: number;
  /** Icons, sketches and diagrams: everything the viewer can look at. */
  drawings: number;
}

interface NormalizeContext {
  layout: SceneLayout;
  sceneIndex: number;
  stepIndex: number;
  hasPrevious: boolean;
  bulletsPerSlot: Map<Slot, number>;
  tally: SceneTally;
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
      context.tally.written += 1;
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

      if (context.tally.bullets >= LIMITS.maxBulletsPerScene) {
        warn(
          "slot-overflow",
          `Una escena no lleva más de ${LIMITS.maxBulletsPerScene} viñetas; se descartó "${text}". Lo que sobra hay que dibujarlo, no escribirlo.`,
          sceneIndex,
          stepIndex,
        );
        return null;
      }

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
      context.tally.bullets += 1;
      context.tally.written += 1;

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

      context.tally.drawings += 1;
      const scale = typeof raw.scale === "number" && raw.scale > 0 ? raw.scale : undefined;
      return {
        type: "icon",
        slot: slotOf(raw.slot),
        id: resolved ?? FALLBACK_ICON,
        scale: scale ? Math.min(2, Math.max(0.4, scale)) : undefined,
        color,
      };
    }

    case "sketch": {
      const rawItems = Array.isArray(raw.items) ? raw.items : [];
      const items: SketchItem[] = [];

      for (const entry of rawItems.slice(0, LIMITS.maxSketchItems)) {
        if (!entry || typeof entry !== "object") continue;
        const record = entry as Record<string, unknown>;
        const resolved =
          typeof record.icon === "string" ? resolveIconId(record.icon) : null;
        if (!resolved) {
          warn(
            "unknown-icon",
            `El sketch pedía "${String(record.icon)}", que no está en el vocabulario; esa pieza se omitió.`,
            sceneIndex,
            stepIndex,
          );
          continue;
        }
        items.push({
          icon: resolved,
          label: textOf(record.label, LIMITS.sketchLabelChars) || undefined,
          mark: pick(record.mark, SKETCH_MARKS),
          color: pick(record.color, MARK_COLORS),
        });
      }

      // One picture with nothing to relate to is not a sketch, it is an icon.
      if (items.length === 1) {
        warn(
          "sketch-repaired",
          "El sketch se quedó con un solo dibujo; se convirtió en un icono suelto.",
          sceneIndex,
          stepIndex,
        );
        context.tally.drawings += 1;
        return {
          type: "icon",
          slot: slotOf(raw.slot),
          id: items[0].icon,
          color: items[0].color ?? color,
        };
      }
      if (items.length === 0) {
        warn("empty-scene", "Sketch sin dibujos utilizables; se descartó.", sceneIndex, stepIndex);
        return null;
      }

      context.tally.drawings += 1;
      return {
        type: "sketch",
        slot: slotOf(raw.slot),
        items,
        relation: pick(raw.relation, SKETCH_RELATIONS),
        caption: textOf(raw.caption, LIMITS.captionChars) || undefined,
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

      const kind = pick(raw.kind, DIAGRAM_KINDS) ?? "flow";
      const values = Array.isArray(raw.values)
        ? raw.values.filter((value): value is number => typeof value === "number" && value > 0)
        : undefined;
      const columns =
        typeof raw.columns === "number" && raw.columns >= 2
          ? Math.min(4, Math.round(raw.columns))
          : undefined;

      context.tally.drawings += 1;
      return {
        type: "diagram",
        slot: slotOf(raw.slot),
        kind,
        labels,
        values: values?.length === labels.length ? values : undefined,
        columns,
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
