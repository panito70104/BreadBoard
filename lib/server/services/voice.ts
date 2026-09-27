/**
 * Giving a storyboard its voice, at the length that was paid for.
 *
 * Two things come back from this, and the second is the interesting one. The
 * obvious product is an mp3 per scene. The valuable product is `at` on every
 * step: the second its trigger phrase is actually spoken, read off the voice's
 * own character timings. That is what lets the hand draw a thing at the moment
 * the narrator says it, instead of somewhere near it.
 *
 * Scene length also stops being a guess here. Up to this point a scene lasts
 * what the model estimated; from here it lasts as long as the sentence takes to
 * say, plus a beat to breathe.
 *
 * **But a minute bought has to be about a minute delivered.** The word budget
 * in the prompt is an open loop — the model writes what it writes, and no
 * words-per-second constant survives contact with a real voice. So the length
 * is measured and then corrected, in whichever direction it went:
 *
 * - **Too long** → read it again slightly faster. Capped, because a narrator
 *   racing to fit is worse than a video that runs ten seconds over.
 * - **Too short** → give the drawing the spare time. The engine already knows
 *   how to wait well: the hand finishes, settles, and leaves the board. Silence
 *   over a finished drawing is how whiteboard videos have always breathed, and
 *   it costs nothing to produce.
 *
 * Nothing in here is allowed to fail a generation. No key, a refused request, a
 * service having a bad day — the video comes out silent with a notice, which is
 * worth far more than no video at all.
 */

import "server-only";

import { objectKey, putObject } from "@/lib/server/storage";
import { phraseStart } from "@/lib/server/voice/align";
import {
  TOLERANCE,
  paceFor,
  sceneSeconds,
  stretch,
} from "@/lib/server/voice/length";
import {
  MAX_SPEED,
  VoiceError,
  speak,
  voiceConfigured,
  type Speech,
} from "@/lib/server/voice/elevenlabs";
import type {
  Storyboard,
  StoryboardScene,
  StoryboardWarning,
} from "@/types/storyboard";

export interface NarrationResult {
  storyboard: Storyboard;
  warnings: StoryboardWarning[];
  /** Scenes that came back with audio. */
  voiced: number;
}

export interface NarrationTarget {
  ownerId: string;
  videoId: string;
  /** What the student paid for, in seconds. */
  targetSeconds: number;
}

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

interface Pass {
  /** Aligned with the storyboard's scenes; null where there is nothing spoken. */
  speeches: (Speech | null)[];
  failure: { sceneIndex: number; message: string } | null;
  spokenSeconds: number;
}

/**
 * Reads every scene at one pace.
 *
 * Nothing is uploaded here. A pass that is thrown away — because it came back
 * too long and was read again — must not leave half the video's audio at one
 * speed and half at another, so storage is only touched once a pass has won.
 */
async function readAloud(
  scenes: StoryboardScene[],
  language: string,
  speed: number,
): Promise<Pass> {
  const speeches: (Speech | null)[] = [];
  let spokenSeconds = 0;

  for (const scene of scenes) {
    if (!scene.narration.trim()) {
      speeches.push(null);
      continue;
    }

    try {
      const speech = await speak(scene.narration, language, speed);
      speeches.push(speech);
      spokenSeconds += speech.durationSeconds;
    } catch (error) {
      // Stop at the first failure rather than retrying the same problem once
      // per scene: an expired key or an empty quota fails all of them, slowly.
      console.error(`[voice] escena ${scene.index}`, error);
      const message =
        error instanceof VoiceError
          ? error.message
          : "No pudimos generar la voz de este video.";

      while (speeches.length < scenes.length) speeches.push(null);
      return { speeches, failure: { sceneIndex: scene.index, message }, spokenSeconds };
    }
  }

  return { speeches, failure: null, spokenSeconds };
}

/* -------------------------------------------------------------------------- */
/*                                  Assembly                                  */
/* -------------------------------------------------------------------------- */

async function assemble(
  scene: StoryboardScene,
  speech: Speech,
  target: NarrationTarget,
): Promise<StoryboardScene> {
  const key = objectKey(target.ownerId, target.videoId, `voz-${scene.index}.mp3`);
  await putObject("videos", key, speech.audio, "audio/mpeg");

  return {
    ...scene,
    // Each step now knows its own second rather than its share of the scene.
    steps: scene.steps.map((step) => {
      const at = step.on ? phraseStart(speech.alignment, step.on) : null;
      return at === null ? step : { ...step, at };
    }),
    durationSeconds: sceneSeconds(speech.durationSeconds),
    audio: { key, durationSeconds: speech.durationSeconds, voiceId: speech.voiceId },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Narrate                                   */
/* -------------------------------------------------------------------------- */

export async function narrate(
  storyboard: Storyboard,
  target: NarrationTarget,
): Promise<NarrationResult> {
  if (!voiceConfigured()) {
    return {
      storyboard,
      voiced: 0,
      warnings: [
        {
          code: "voice-skipped",
          message:
            "No hay clave de ElevenLabs configurada, así que el video salió sin voz.",
        },
      ],
    };
  }

  const warnings: StoryboardWarning[] = [];

  let pass = await readAloud(storyboard.scenes, storyboard.language, 1);

  // Only worth re-reading a complete pass; a broken one will break again.
  const pace = pass.failure
    ? null
    : paceFor(pass.spokenSeconds, target.targetSeconds, MAX_SPEED);
  if (pace) {
    const faster = await readAloud(storyboard.scenes, storyboard.language, pace);
    if (!faster.failure) pass = faster;
  }

  if (pass.failure) {
    warnings.push({
      code: "voice-failed",
      message: `${pass.failure.message} Las escenas a partir de la ${pass.failure.sceneIndex} quedaron sin narrar.`,
      sceneIndex: pass.failure.sceneIndex,
    });
  }

  const scenes: StoryboardScene[] = [];
  for (const [index, scene] of storyboard.scenes.entries()) {
    const speech = pass.speeches[index];
    scenes.push(speech ? await assemble(scene, speech, target) : scene);
  }

  const stretched = stretch(scenes, target.targetSeconds);
  const totalSeconds = stretched.reduce((sum, scene) => sum + scene.durationSeconds, 0);

  // The one number worth watching: how many words a second this voice really
  // reads at. `LIMITS.wordsPerSecond`, which sizes the narration in the prompt,
  // is only a guess until it has been compared with this.
  if (pass.spokenSeconds > 0) {
    const words = storyboard.scenes.reduce(
      (sum, scene) => sum + scene.narration.split(/\s+/).filter(Boolean).length,
      0,
    );
    console.log(
      `[voice] ${target.videoId}: ${words} palabras en ${pass.spokenSeconds.toFixed(1)}s ` +
        `(${(words / pass.spokenSeconds).toFixed(2)} palabras/s) · ` +
        `objetivo ${target.targetSeconds}s · video ${totalSeconds.toFixed(1)}s` +
        (pace ? ` · leído a ${pace.toFixed(2)}x` : ""),
    );
  }

  const drift = Math.abs(totalSeconds - target.targetSeconds) / target.targetSeconds;
  if (drift > TOLERANCE && pass.spokenSeconds > 0) {
    warnings.push({
      code: "duration-estimated",
      message:
        `El video dura ${Math.round(totalSeconds)}s para ${target.targetSeconds}s pedidos. ` +
        (totalSeconds > target.targetSeconds
          ? "La narración salió larga incluso leída rápido."
          : "La narración salió corta; sobra tiempo de dibujo."),
    });
  }

  return {
    storyboard: { ...storyboard, scenes: stretched, totalSeconds },
    warnings,
    voiced: stretched.filter((scene) => scene.audio).length,
  };
}
