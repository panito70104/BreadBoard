/**
 * Turns a storyboard into frames.
 *
 * Each step declares `on`: the phrase of the narration it belongs to. Once the
 * voice-over has been generated, that phrase has been looked up in ElevenLabs'
 * character timings and the step carries `at` — the second it is actually
 * spoken. The drawing then lands on the word.
 *
 * Without a voice-over the engine falls back to **where the phrase sits in the
 * narration text**: a phrase 40% of the way through the sentence fires 40% of
 * the way through the scene. Reading pace is roughly even, so it is a decent
 * stand-in, and it means a silent storyboard still plays.
 */

import { BOARD } from "@/lib/engine/board";
import { normalizeForMatch } from "@/lib/storyboard/normalize";
import type {
  DrawElement,
  Storyboard,
  StoryboardScene,
  StoryboardStep,
} from "@/types/storyboard";

export interface TimedStep {
  step: StoryboardStep;
  /** Index of this step inside its scene. */
  index: number;
  /** Absolute frame where the drawing starts. */
  from: number;
  /** Frames the drawing takes. */
  durationInFrames: number;
}

export interface TimedScene {
  scene: StoryboardScene;
  from: number;
  durationInFrames: number;
  steps: TimedStep[];
}

export interface Timeline {
  scenes: TimedScene[];
  durationInFrames: number;
}

const MIN_STEP_SECONDS = 0.5;
/**
 * Room left between two steps for the hand to get there.
 *
 * It used to be 0.12s, which is less than a person takes to move their arm
 * anywhere at all — so the hand was always either teleporting or crawling.
 * Crossing the whole board takes about 0.9s and a typical hop about half that;
 * this covers the typical one without stealing much from the drawing, and the
 * long ones are simply taken fast.
 */
export const STEP_GAP_SECONDS = 0.45;
/** How far the drawing may be rushed before the gaps start giving way too. */
const MIN_DRAW_SCALE = 0.55;
const MIN_GAP_SCALE = 0.4;

/**
 * How long the hand should spend on each kind of element.
 *
 * This is an estimate, and it runs before any geometry exists — the timeline
 * has to hand out frames before the planner knows how long the strokes are. The
 * pen schedule computes the truth later and fits itself into whatever it is
 * given, finishing early rather than slowing down. So these numbers only need
 * to be close, and they are deliberately generous: a step that gets too little
 * room is drawn fast, which reads worse than a step that finishes and waits.
 */
function drawSeconds(element: DrawElement): number {
  switch (element.type) {
    case "title":
      return Math.max(1.2, element.text.length * 0.06);
    case "text":
      return Math.max(1, element.text.length * 0.058);
    case "bullet":
      return Math.max(0.9, element.text.length * 0.058);
    case "formula":
      return Math.max(1.3, element.text.length * 0.075);
    case "icon":
      return 1.4;
    case "arrow":
      return 0.7;
    case "emphasis":
      return element.shape === "box" ? 1 : 0.6;
    case "sketch":
      // A drawing and a word per item, plus whatever joins them.
      return (
        0.5 +
        element.items.reduce(
          (sum, item) => sum + 1.3 + (item.label ? 0.3 + item.label.length * 0.05 : 0),
          0,
        ) +
        (element.relation && element.relation !== "none" ? 0.35 * (element.items.length - 1) : 0) +
        (element.caption ? 0.3 + element.caption.length * 0.05 : 0)
      );
    case "diagram":
      // Strokes plus every label written out.
      return 1.8 + element.labels.reduce((sum, label) => sum + 0.32 + label.length * 0.05, 0);
    case "erase":
      // Three passes across whatever is being wiped. Rushing it turns the
      // eraser into a blur and the board into a jump cut.
      return 1.5;
  }
}

/** Where in the narration (0–1) the trigger phrase starts. */
function phraseRatio(narration: string, phrase: string | null): number | null {
  if (!phrase) return null;
  const haystack = normalizeForMatch(narration);
  const needle = normalizeForMatch(phrase);
  if (!haystack || !needle) return null;

  const at = haystack.indexOf(needle);
  if (at < 0) return null;
  return at / haystack.length;
}

/**
 * When the scene has a voice-over, the step already knows the second it is
 * spoken at — measured off the voice's own character timings during generation.
 * Everything else here is the fallback for a storyboard with no voice yet.
 */
function startRatio(scene: StoryboardScene, step: StoryboardStep, index: number): number {
  if (step.at !== undefined && scene.durationSeconds > 0) {
    return Math.min(0.995, Math.max(0, step.at / scene.durationSeconds));
  }
  const found = phraseRatio(scene.narration, step.on);
  // Without a match, spread the step evenly and leave a lead-in.
  return found ?? (scene.steps.length === 1 ? 0 : (index / scene.steps.length) * 0.9);
}

function buildScene(
  scene: StoryboardScene,
  from: number,
  natural?: number[],
  approach?: number[],
): TimedScene {
  const durationInFrames = Math.round(scene.durationSeconds * BOARD.fps);
  const count = scene.steps.length;

  // Preferred start of each step, as a fraction of the scene.
  const ratios = scene.steps.map((step, index) => startRatio(scene, step, index));

  // What each step wants. `natural` is what the pen schedule measured on the
  // real geometry; the estimate is only used on the first pass, before any
  // geometry exists. Likewise `approach` is the real distance the hand has to
  // cover to get there, and the flat gap is only a stand-in for it.
  const wanted = scene.steps.map((step, index) =>
    Math.max(MIN_STEP_SECONDS, natural?.[index] || drawSeconds(step.draw)),
  );
  const gaps = scene.steps.map((_, index) => approach?.[index] ?? STEP_GAP_SECONDS);

  const drawTotal = wanted.reduce((sum, value) => sum + value, 0);
  const gapTotal = gaps.reduce((sum, value) => sum + value, 0);

  /**
   * A scene cannot hold more than it lasts. When it is asked to, the drawing
   * gives way before the movement does: a stroke drawn a third faster still
   * reads as a stroke, while a hand that crosses the board in three frames
   * reads as a dropped shot. Only when the drawing is already at its floor do
   * the gaps start to close too.
   */
  let drawScale = 1;
  let gapScale = 1;
  if (drawTotal + gapTotal > scene.durationSeconds) {
    const room = scene.durationSeconds - gapTotal;
    drawScale = Math.max(MIN_DRAW_SCALE, room / drawTotal);
    if (drawTotal * drawScale + gapTotal > scene.durationSeconds) {
      gapScale = Math.max(
        MIN_GAP_SCALE,
        (scene.durationSeconds - drawTotal * drawScale) / gapTotal,
      );
    }
  }

  /**
   * Where each step starts, in seconds into the scene.
   *
   * With a voice-over the answer is not negotiable: `at` is the second the
   * phrase is spoken, measured off the audio, and the drawing has to be there.
   * Anything else and the hand is illustrating a sentence the narrator finished
   * two seconds ago. So the drawing gives way instead — a step whose neighbour
   * is spoken right after it simply gets less time and is drawn faster.
   *
   * Without a voice-over none of these numbers are real. The starts are guesses
   * from where the phrase sits in the narration text, so they are packed by
   * demand instead: each step gets the room it needs and is pushed later when
   * the one before it has not finished.
   */
  const voiced = scene.steps.some((step) => step.at !== undefined);
  const starts: number[] = [];

  if (voiced) {
    let previous = 0;
    for (let index = 0; index < count; index += 1) {
      // Never before the step before it — an `at` out of order means the phrase
      // matched in the wrong place, not that the drawing should go backwards.
      const start = Math.min(
        scene.durationSeconds,
        Math.max(previous, ratios[index] * scene.durationSeconds),
      );
      starts.push(start);
      previous = start;
    }
  } else {
    let cursor = 0;
    for (let index = 0; index < count; index += 1) {
      const earliest = cursor + gaps[index] * gapScale;
      const start = Math.max(ratios[index] * scene.durationSeconds, earliest);
      starts.push(start);
      cursor = start + wanted[index] * drawScale;
    }

    // Late phrases can push the tail past the end of the scene. Pull the whole
    // run back into the lead-in, and if that is not enough, give up on the
    // phrases and pack purely by demand.
    if (cursor > scene.durationSeconds) {
      const shift = Math.min(cursor - scene.durationSeconds, starts[0]);
      for (let index = 0; index < count; index += 1) starts[index] -= shift;

      if (starts[count - 1] + wanted[count - 1] * drawScale > scene.durationSeconds) {
        let packed = 0;
        for (let index = 0; index < count; index += 1) {
          packed += gaps[index] * gapScale;
          starts[index] = packed;
          packed += wanted[index] * drawScale;
        }
      }
    }
  }

  const steps: TimedStep[] = scene.steps.map((step, index) => {
    const startFrame = from + Math.round(starts[index] * BOARD.fps);
    const nextFrame =
      index + 1 < count
        ? from + Math.round(starts[index + 1] * BOARD.fps)
        : from + durationInFrames;
    const room = nextFrame - startFrame;
    const wantedGap =
      index + 1 < count ? Math.round(gaps[index + 1] * gapScale * BOARD.fps) : 0;

    // Room to draw in: whatever is left before the hand has to set off again.
    // When the voice sets the starts, two phrases said close together leave
    // less room than the reach between them wants; the travel then takes what
    // it can rather than swallowing the drawing whole.
    const nextGap = voiced ? Math.min(wantedGap, Math.round(room * 0.4)) : wantedGap;
    // And the floor drops, because a drawing that runs past its own cue is
    // worse than a hurried one: the hand would be illustrating the sentence
    // after it.
    const floor = voiced ? 6 : Math.round(MIN_STEP_SECONDS * drawScale * BOARD.fps);

    const available = Math.max(Math.max(1, floor), room - nextGap);

    return {
      step,
      index,
      from: startFrame,
      // Never longer than the drawing wants. A step with room to spare
      // finishes and the hand waits, which is what a person does.
      durationInFrames: Math.min(
        Math.round(wanted[index] * drawScale * BOARD.fps),
        available,
      ),
    };
  });

  return { scene, from, durationInFrames, steps };
}

/**
 * `natural` is the seconds each step's drawing really takes and `approach` the
 * seconds the hand needs to get to it, per scene. Both are measured off the
 * planned geometry, which is why `planStoryboard` builds the timeline twice.
 *
 * The total never depends on it: a scene lasts exactly its `durationSeconds`,
 * because the voice-over is written to that length and the student paid for it.
 * Only the division of the scene between its steps changes.
 */
export function buildTimeline(
  storyboard: Storyboard,
  natural?: number[][],
  approach?: number[][],
): Timeline {
  let cursor = 0;
  const scenes = storyboard.scenes.map((scene, index) => {
    const timed = buildScene(scene, cursor, natural?.[index], approach?.[index]);
    cursor += timed.durationInFrames;
    return timed;
  });

  return { scenes, durationInFrames: Math.max(cursor, BOARD.fps) };
}

/** 0 before the step starts, 1 once it is fully drawn. */
export function stepProgress(frame: number, step: TimedStep): number {
  if (frame <= step.from) return 0;
  if (frame >= step.from + step.durationInFrames) return 1;
  return (frame - step.from) / step.durationInFrames;
}

/** The step the hand is currently drawing, if any. */
export function activeStep(frame: number, scene: TimedScene): TimedStep | null {
  return (
    scene.steps.find(
      (step) => frame >= step.from && frame < step.from + step.durationInFrames,
    ) ?? null
  );
}

export function sceneAtFrame(frame: number, timeline: Timeline): TimedScene | null {
  return (
    timeline.scenes.find(
      (scene) => frame >= scene.from && frame < scene.from + scene.durationInFrames,
    ) ??
    timeline.scenes.at(-1) ??
    null
  );
}
