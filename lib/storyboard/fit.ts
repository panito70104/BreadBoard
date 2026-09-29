/**
 * Shaping a storyboard to the length it is supposed to be.
 *
 * Pure, and deliberately not in `services/storyboard-provider.ts`, which is
 * `server-only`: the verification scripts run the storyboard half of the
 * pipeline headlessly, with no database and no storage, and importing a
 * server-only module from a script fails at require time.
 */

import { LIMITS } from "@/lib/storyboard/schema";
import type { Storyboard } from "@/types/storyboard";

/**
 * Stretches or squeezes scene lengths so the video lasts what was paid for.
 * The student is charged the minutes they chose; a model that overshoots or
 * undershoots should not change what they receive.
 */
export function fitToDuration(storyboard: Storyboard, targetSeconds: number): Storyboard {
  const total = storyboard.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (total <= 0 || storyboard.scenes.length === 0) return storyboard;

  const factor = targetSeconds / total;
  const scenes = storyboard.scenes.map((scene) => ({
    ...scene,
    durationSeconds: Math.min(
      LIMITS.maxSceneSeconds,
      Math.max(LIMITS.minSceneSeconds, Math.round(scene.durationSeconds * factor)),
    ),
  }));

  return {
    ...storyboard,
    scenes,
    totalSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
  };
}
