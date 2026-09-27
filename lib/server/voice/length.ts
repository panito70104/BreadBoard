/**
 * Making a video last about as long as was paid for.
 *
 * The narration is sized by a word budget in the prompt, which is an open loop:
 * the model writes what it writes, and no words-per-second constant survives
 * contact with a real voice. So the length is measured once the voice exists and
 * corrected, in whichever direction it went.
 *
 * Correcting up and correcting down are not symmetric, which is the whole idea
 * here. Reading faster is a real cost — past a point the narrator sounds like a
 * disclaimer — so it is capped and used only when the script came back long.
 * Running short costs nothing: the spare seconds go to the drawing, where the
 * hand has already finished and is waiting anyway. Silence over a finished
 * drawing is how whiteboard videos have always breathed.
 *
 * Pure arithmetic, so the promise "a minute bought is about a minute long" can
 * be checked without spending anything.
 */

import type { StoryboardScene } from "@/types/storyboard";

/** How far off the paid length is close enough to leave alone. */
export const TOLERANCE = 0.12;
/** A beat after the last word, so a scene does not cut on the closing syllable. */
export const TAIL_SECONDS = 0.7;
/** However short the line, a scene needs room to be looked at. */
export const MIN_SCENE_SECONDS = 2.5;
/**
 * The most a scene may be padded out past its own speech.
 *
 * Without a cap, a storyboard that came back half as long as it should turns
 * into a video that is mostly a hand hovering over finished drawings. Better a
 * short video than a slow one.
 */
export const MAX_STRETCH = 1.5;

export const roundSeconds = (value: number) => Math.round(value * 10) / 10;

/** How long a scene lasts, given how long its line took to say. */
export function sceneSeconds(speechSeconds: number): number {
  return Math.max(MIN_SCENE_SECONDS, roundSeconds(speechSeconds + TAIL_SECONDS));
}

/**
 * The pace this storyboard has to be read at to fit, or null to leave it alone.
 *
 * Only ever speeds up. A script that came back short is not read slowly to pad
 * it out — that sounds like a fault, where silence between drawings does not.
 */
export function paceFor(
  spokenSeconds: number,
  targetSeconds: number,
  maxSpeed: number,
): number | null {
  if (spokenSeconds <= 0 || targetSeconds <= 0) return null;
  if (spokenSeconds <= targetSeconds * (1 + TOLERANCE)) return null;
  return Math.min(maxSpeed, spokenSeconds / targetSeconds);
}

/** Spends whatever is left of the paid length on the drawing. */
export function stretch(
  scenes: StoryboardScene[],
  targetSeconds: number,
): StoryboardScene[] {
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total <= 0 || total >= targetSeconds * (1 - TOLERANCE)) return scenes;

  const factor = Math.min(MAX_STRETCH, targetSeconds / total);
  return scenes.map((scene) => ({
    ...scene,
    durationSeconds: roundSeconds(scene.durationSeconds * factor),
  }));
}
