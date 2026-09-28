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
  return phraseTimes(alignment, [phrase])[0];
}

/**
 * The second each phrase is spoken, for a scene's steps in drawing order.
 *
 * Reading them together rather than one at a time is what makes a scene that
 * quotes the same words twice work. A model asked for a verbatim phrase per
 * step routinely gives two steps the same one — a title and the emphasis under
 * it, say — and looking each up from the beginning hands both the *first*
 * occurrence, so two drawings land on the same instant and the hand draws them
 * on top of each other. Scanning forward gives the second step the next
 * occurrence, which is the one it meant.
 *
 * A phrase that is not ahead of the cursor is still looked for in the whole
 * sentence: the model can quote out of order, and a step placed on its own
 * words in the wrong order beats a step spread by arithmetic.
 *
 * It also normalizes the spoken text once instead of once per step.
 */
export function phraseTimes(
  alignment: Alignment,
  phrases: readonly (string | null)[],
): (number | null)[] {
  const spoken = normalizeWithIndex(alignment.characters.join(""));
  let cursor = 0;

  return phrases.map((phrase) => {
    const needle = phrase ? normalizeForMatch(phrase) : "";
    if (!needle) return null;

    let at = spoken.text.indexOf(needle, cursor);
    if (at < 0) at = spoken.text.indexOf(needle);
    if (at < 0) return null;

    cursor = at + needle.length;
    const start = alignment.character_start_times_seconds[spoken.index[at]];
    return Number.isFinite(start) ? start : null;
  });
}
