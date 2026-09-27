/**
 * One way of comparing text, shared by everything that has to find a phrase.
 *
 * Three different places need to decide whether a trigger phrase appears in a
 * narration: the validator checks it, the engine falls back to it when there is
 * no voice-over, and the aligner maps it onto the voice timings. If any two of
 * them normalized differently, a phrase would validate and then fail to align —
 * silently, as a drawing landing at the wrong moment.
 *
 * The aligner also needs to walk back from a position in the normalized text to
 * the same position in the original, because that is what the timings are
 * indexed by. So normalizing returns the map as well.
 */

export interface Normalized {
  text: string;
  /** `index[i]` is the position in the original string of normalized character `i`. */
  index: number[];
}

/**
 * Accents folded, case dropped, punctuation turned into single spaces.
 *
 * Letters and digits are matched by Unicode property rather than `a-z0-9`, so a
 * narration in a language this app has not been tried in yet does not collapse
 * into nothing.
 */
export function normalizeWithIndex(value: string): Normalized {
  const text: string[] = [];
  const index: number[] = [];
  let pendingSpace = false;

  for (let at = 0; at < value.length; at += 1) {
    const folded = value[at]
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();

    // A character can fold to nothing (a lone combining mark) or to several
    // (a ligature); the whole run points back at where it came from.
    if (folded.length === 0) continue;

    if (/^[\p{L}\p{N}]+$/u.test(folded)) {
      // A separator only becomes a space between two words, never leading —
      // and the flag has to clear whether or not one was written, or an
      // opening "¿" leaves every following letter looking like a new word.
      if (pendingSpace && text.length > 0) {
        text.push(" ");
        index.push(at);
      }
      pendingSpace = false;

      for (const character of folded) {
        text.push(character);
        index.push(at);
      }
    } else {
      pendingSpace = true;
    }
  }

  return { text: text.join(""), index };
}

export function normalizeForMatch(value: string): string {
  return normalizeWithIndex(value).text;
}
