/**
 * Text layout for the board.
 *
 * The hand has to sit at the exact point where the next glyph appears, so the
 * engine needs to know, for any progress value, which word is being written and
 * how far into it the pen is. That means laying the text out ourselves instead
 * of letting the browser wrap it — down to the position of every character,
 * because a word revealed as one smooth sweep does not read as handwriting. It
 * reads as a blind coming down.
 *
 * Measurement goes through a canvas, which is deterministic given the same font
 * — the same numbers in the Player and in a headless render.
 */

import { clamp01, smoothstep } from "@/lib/engine/motion";

let context: CanvasRenderingContext2D | null = null;

function measureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!context) {
    context = document.createElement("canvas").getContext("2d");
  }
  return context;
}

/** Rough fallback when canvas is unavailable (SSR pass before hydration). */
const FALLBACK_RATIO = 0.46;

/** Where the writing line sits inside a line box, as a fraction of its height. */
export const WRITING_LINE = 0.78;

/**
 * Vertical metrics of the handwriting face, as fractions of the type size.
 *
 * Measured on Caveat through `measureText` at 18, 22, 32, 36 and 46px: both
 * come out identical at every size, which is what a proportional face does.
 * They are here because "legible" is a statement about x-height, not about
 * type size — the same 32px is a different amount of ink in a different face.
 */
export const CAP_HEIGHT = 0.701;
export const X_HEIGHT = 0.357;

const resolved = new Map<string, string>();

/**
 * Canvas does not resolve CSS custom properties: setting `ctx.font` to
 * `48px var(--font-hand)` is invalid, so the context silently keeps its default
 * 10px sans-serif and every measurement comes back wrong. Words then overlap.
 * Resolve the variable against the document first.
 */
function resolveFontFamily(fontFamily: string): string {
  if (!fontFamily.includes("var(")) return fontFamily;
  if (typeof document === "undefined") return "cursive";

  const cached = resolved.get(fontFamily);
  if (cached) return cached;

  const name = fontFamily.match(/var\((--[\w-]+)\)/)?.[1];
  const value = name
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : "";
  const family = value ? fontFamily.replace(/var\(--[\w-]+\)/, value) : "cursive";

  resolved.set(fontFamily, family);
  return family;
}

export function measureWidth(text: string, fontSize: number, fontFamily: string) {
  const ctx = measureContext();
  if (!ctx) return text.length * fontSize * FALLBACK_RATIO;
  ctx.font = `${fontSize}px ${resolveFontFamily(fontFamily)}`;
  return ctx.measureText(text).width;
}

/**
 * The x of every character boundary in a word, cumulative from its left edge.
 *
 * Measured as prefixes rather than per character so kerning is included: the
 * last entry is the word's real width, and the pen never drifts off the glyphs.
 */
const advanceCache = new Map<string, number[]>();

function advancesOf(text: string, fontSize: number, fontFamily: string): number[] {
  const key = `${text}\u0000${fontSize}\u0000${fontFamily}`;
  const cached = advanceCache.get(key);
  if (cached) return cached;

  const advances = [0];
  for (let i = 1; i <= text.length; i += 1) {
    advances.push(measureWidth(text.slice(0, i), fontSize, fontFamily));
  }

  if (advanceCache.size > 6000) advanceCache.clear();
  advanceCache.set(key, advances);
  return advances;
}

export interface LaidOutWord {
  text: string;
  /** Left edge of the word, relative to the text block. */
  x: number;
  /** Top of the line box the word sits on, relative to the block. */
  y: number;
  width: number;
  line: number;
  /** Character boundaries, from 0 to `width`. */
  advances: number[];
}

/** One line of the wrapped block: which words are on it, and where it sits. */
export interface TextRow {
  /** Indices into `words`. */
  words: number[];
  /** Top of the line box, relative to the block. */
  y: number;
}

export interface TextLayout {
  words: LaidOutWord[];
  rows: TextRow[];
  width: number;
  height: number;
  lineHeight: number;
}

const layoutCache = new Map<string, TextLayout>();

/**
 * Measurements depend on the web font being loaded; anything measured with the
 * fallback font is wrong. Call this once fonts are ready to discard it — the
 * resolved family goes too, because it may have been resolved before the
 * stylesheet that defines it was applied.
 */
export function clearTextCache() {
  layoutCache.clear();
  advanceCache.clear();
  resolved.clear();
}

export function layoutText(
  text: string,
  options: {
    fontSize: number;
    fontFamily: string;
    maxWidth: number;
    lineHeightRatio?: number;
  },
): TextLayout {
  const key = `${text}\u0000${options.fontSize}\u0000${options.fontFamily}\u0000${options.maxWidth}\u0000${options.lineHeightRatio ?? 1.25}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;
  const result = computeLayout(text, options);
  if (layoutCache.size > 2000) layoutCache.clear();
  layoutCache.set(key, result);
  return result;
}

/** Greedy word wrap inside `maxWidth`, keeping the position of every word. */
function computeLayout(
  text: string,
  {
    fontSize,
    fontFamily,
    maxWidth,
    lineHeightRatio = 1.25,
  }: {
    fontSize: number;
    fontFamily: string;
    maxWidth: number;
    lineHeightRatio?: number;
  },
): TextLayout {
  const lineHeight = fontSize * lineHeightRatio;
  const spaceWidth = measureWidth(" ", fontSize, fontFamily);

  const words: LaidOutWord[] = [];
  const rows: TextRow[] = [{ words: [], y: 0 }];
  let line = 0;
  let cursor = 0;
  let widest = 0;

  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const advances = advancesOf(raw, fontSize, fontFamily);
    const width = advances[advances.length - 1];

    if (cursor > 0 && cursor + spaceWidth + width > maxWidth) {
      line += 1;
      cursor = 0;
      rows.push({ words: [], y: line * lineHeight });
    }

    const x = cursor === 0 ? 0 : cursor + spaceWidth;
    rows[line].words.push(words.length);
    words.push({ text: raw, x, y: line * lineHeight, width, line, advances });
    cursor = x + width;
    widest = Math.max(widest, cursor);
  }

  return {
    words,
    rows: rows.filter((row) => row.words.length > 0),
    width: widest,
    height: (line + 1) * lineHeight,
    lineHeight,
  };
}

/**
 * Where the pen is inside a word, in pixels from its left edge.
 *
 * Quantized to characters and eased inside each one, so the reveal moves the
 * way a letter is written — a push through the glyph and a beat at its end —
 * rather than sweeping the whole word at a constant rate.
 */
export function wordPen(word: LaidOutWord, progress: number): number {
  const { advances } = word;
  const count = advances.length - 1;
  if (count <= 0) return 0;
  if (progress >= 1) return advances[count];

  const exact = clamp01(progress) * count;
  const index = Math.min(count - 1, Math.floor(exact));
  const inside = smoothstep(exact - index);
  return advances[index] + (advances[index + 1] - advances[index]) * inside;
}
