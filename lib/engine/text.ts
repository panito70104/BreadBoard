/**
 * Text layout for the board.
 *
 * The hand has to sit at the exact point where the next glyph appears, so the
 * engine needs to know, for any progress value, which word is being written and
 * where it ends. That means laying the text out ourselves instead of letting
 * the browser wrap it.
 *
 * Measurement goes through a canvas, which is deterministic given the same font
 * — the same numbers in the Player and in a headless render.
 */

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

export interface LaidOutWord {
  text: string;
  /** Left edge of the word, relative to the text block. */
  x: number;
  /** Baseline-ish top of the line the word sits on. */
  y: number;
  width: number;
  line: number;
}

export interface TextLayout {
  words: LaidOutWord[];
  lines: number;
  width: number;
  height: number;
  lineHeight: number;
}

/**
 * Greedy word wrap inside `maxWidth`, returning the position of every word so
 * the reveal and the hand can be driven off the same numbers.
 */
export function layoutText(
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
  let line = 0;
  let cursor = 0;
  let widest = 0;

  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const width = measureWidth(raw, fontSize, fontFamily);
    if (cursor > 0 && cursor + spaceWidth + width > maxWidth) {
      line += 1;
      cursor = 0;
    }
    const x = cursor === 0 ? 0 : cursor + spaceWidth;
    words.push({ text: raw, x, y: line * lineHeight, width, line });
    cursor = x + width;
    widest = Math.max(widest, cursor);
  }

  return {
    words,
    lines: line + 1,
    width: widest,
    height: (line + 1) * lineHeight,
    lineHeight,
  };
}

export interface WritingHead {
  /** Where the tip of the marker is right now. */
  x: number;
  y: number;
  /** Words fully written, plus the partial fraction of the current one. */
  visibleWords: number;
  partial: number;
}

/**
 * The writing head at a given progress (0–1) through the block: the hand sits
 * at the right edge of whatever is being written.
 */
export function writingHead(layout: TextLayout, progress: number): WritingHead {
  const total = layout.words.length;
  if (total === 0) return { x: 0, y: 0, visibleWords: 0, partial: 0 };

  const exact = Math.min(progress * total, total);
  const index = Math.min(Math.floor(exact), total - 1);
  const partial = exact - index;
  const word = layout.words[index];

  return {
    x: word.x + word.width * (progress >= 1 ? 1 : partial),
    // Sit on the writing line, a touch below the middle of the glyphs.
    y: word.y + layout.lineHeight * 0.78,
    visibleWords: index,
    partial: progress >= 1 ? 1 : partial,
  };
}
