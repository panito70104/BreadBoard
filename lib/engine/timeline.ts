/**
 * Turns a storyboard into frames.
 *
 * Each step declares `on`: the phrase of the narration it belongs to. With real
 * audio we would look that phrase up in the TTS word timings. Until the
 * voice-over exists we approximate it by **where the phrase sits in the
 * narration text** — a phrase 40% of the way through the sentence fires 40% of
 * the way through the scene. It is a good enough stand-in because reading pace
 * is roughly even, and it means the `on` field is already load-bearing instead
 * of decorative.
 *
 * TODO(voice): replace `phraseRatio` with a lookup into ElevenLabs' character
 * timings. Nothing else in this file changes.
 */

import { BOARD } from "@/lib/engine/board";
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

const MIN_STEP_SECONDS = 0.45;
const STEP_GAP_SECONDS = 0.12;

/** How long the hand should spend drawing each kind of element. */
function drawSeconds(element: DrawElement): number {
  switch (element.type) {
    case "title":
      return Math.max(1.1, element.text.length * 0.055);
    case "text":
      return Math.max(0.9, element.text.length * 0.05);
    case "bullet":
      return Math.max(0.8, element.text.length * 0.05);
    case "formula":
      return Math.max(1.2, element.text.length * 0.07);
    case "icon":
      return 1.1;
    case "arrow":
      return 0.55;
    case "emphasis":
      return element.shape === "box" ? 0.9 : 0.5;
    case "diagram":
      return 1.2 + element.labels.length * 0.35;
    case "erase":
      return 0.8;
  }
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Where in the narration (0–1) the trigger phrase starts. */
function phraseRatio(narration: string, phrase: string | null): number | null {
  if (!phrase) return null;
  const haystack = normalize(narration);
  const needle = normalize(phrase);
  if (!haystack || !needle) return null;

  const at = haystack.indexOf(needle);
  if (at < 0) return null;
  return at / haystack.length;
}

function buildScene(scene: StoryboardScene, from: number): TimedScene {
  const durationInFrames = Math.round(scene.durationSeconds * BOARD.fps);
  const count = scene.steps.length;

  // Preferred start of each step, as a fraction of the scene.
  const ratios = scene.steps.map((step, index) => {
    const found = phraseRatio(scene.narration, step.on);
    // Without a match, spread the step evenly and leave a lead-in.
    return found ?? (count === 1 ? 0 : (index / count) * 0.9);
  });

  // Keep them in order: a later step can never start before an earlier one.
  const minGap = (MIN_STEP_SECONDS + STEP_GAP_SECONDS) / Math.max(scene.durationSeconds, 1);
  let previous = -minGap;
  const starts = ratios.map((ratio) => {
    const value = Math.max(ratio, previous + minGap);
    previous = value;
    return Math.min(value, 0.995);
  });

  const steps: TimedStep[] = scene.steps.map((step, index) => {
    const startFrame = from + Math.round(starts[index] * durationInFrames);
    const nextFrame =
      index + 1 < count
        ? from + Math.round(starts[index + 1] * durationInFrames)
        : from + durationInFrames;

    const wanted = Math.round(drawSeconds(step.draw) * BOARD.fps);
    const available = Math.max(
      Math.round(MIN_STEP_SECONDS * BOARD.fps),
      nextFrame - startFrame - Math.round(STEP_GAP_SECONDS * BOARD.fps),
    );

    return {
      step,
      index,
      from: startFrame,
      durationInFrames: Math.min(wanted, available),
    };
  });

  return { scene, from, durationInFrames, steps };
}

export function buildTimeline(storyboard: Storyboard): Timeline {
  let cursor = 0;
  const scenes = storyboard.scenes.map((scene) => {
    const timed = buildScene(scene, cursor);
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
