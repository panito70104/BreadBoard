/**
 * Finding a trigger phrase in the voice-over.
 *
 * The storyboard says a step happens `on` a phrase of the narration, and the
 * voice comes back with the second at which every character was spoken. This
 * joins the two: it locates the phrase in the spoken text and reads off the
 * time the first character of it starts.
 *
 * The comparison has to ignore case, accents and punctuation, or a phrase the
 * validator accepted would fail to align here. But the timings are indexed by
 * position in the *original* text, so normalizing has to be reversible —
 * which is why `normalizeWithIndex` hands back the map as well.
 *
 * Pure arithmetic over its arguments, deliberately: it is the piece most worth
 * testing and it has no business touching the network or the environment.
 */

import { normalizeForMatch, normalizeWithIndex } from "@/lib/storyboard/normalize";
import type { Alignment } from "@/lib/server/voice/elevenlabs";

/**
 * Seconds into the speech where `phrase` begins, or null if it is not spoken.
 *
 * The haystack is rebuilt from the alignment's own characters rather than from
 * the narration string, so the indices line up by construction even if the
 * service normalized the text on its way in.
 */
export function phraseStart(alignment: Alignment, phrase: string): number | null {
  const needle = normalizeForMatch(phrase);
  if (!needle) return null;

  const spoken = normalizeWithIndex(alignment.characters.join(""));
  const at = spoken.text.indexOf(needle);
  if (at < 0) return null;

  const original = spoken.index[at];
  const start = alignment.character_start_times_seconds[original];
  return Number.isFinite(start) ? start : null;
}
