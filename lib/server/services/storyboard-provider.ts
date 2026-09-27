/**
 * Where a storyboard comes from: Claude, or the sample template.
 *
 * `STORYBOARD_PROVIDER=auto` (the default) uses Claude when a key is present
 * and the template otherwise, so the whole app works end to end before the
 * key exists — and every template video is labelled as such, never passed off
 * as Claude's work.
 */

import "server-only";

import { buildStoryboard } from "@/data/mock";
import { env } from "@/lib/server/env";
import {
  generateStoryboard,
  StoryboardGenerationError,
} from "@/lib/storyboard/generate";
import { LIMITS, parseStoryboard } from "@/lib/storyboard/schema";
import type { StoryboardRequest } from "@/lib/storyboard/prompt";
import type { Storyboard, StoryboardParseResult } from "@/types/storyboard";

export type ProviderName = "claude" | "mock";

export function resolveProvider(): ProviderName {
  const { STORYBOARD_PROVIDER, ANTHROPIC_API_KEY } = env();
  if (STORYBOARD_PROVIDER !== "auto") return STORYBOARD_PROVIDER;
  return ANTHROPIC_API_KEY ? "claude" : "mock";
}

export const MOCK_NOTICE =
  "Guion de ejemplo: no se leyó tu documento. Añade ANTHROPIC_API_KEY a .env.local para que Claude lo analice.";

export async function produceStoryboard(
  request: StoryboardRequest & { title: string },
): Promise<{ result: StoryboardParseResult; source: ProviderName }> {
  const provider = resolveProvider();

  if (provider === "claude") {
    if (!env().ANTHROPIC_API_KEY) {
      throw new StoryboardGenerationError(
        "STORYBOARD_PROVIDER=claude pero falta ANTHROPIC_API_KEY en .env.local.",
      );
    }
    return { result: await generateStoryboard(request), source: "claude" };
  }

  // The template, run through the same validator Claude's output goes through.
  const result = parseStoryboard(
    {
      videoTitle: request.title,
      scenes: buildStoryboard(request.title.toLowerCase(), "mock"),
    },
    { fallbackTitle: request.title, allowedSeconds: request.allowedSeconds },
  );
  return { result, source: "mock" };
}

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
