/**
 * What a drawing actually covers, as opposed to the room it was given.
 *
 * The planner hands every drawing a slot-derived region and lets it compose
 * itself inside. That region is the right thing to lay out against and the
 * wrong thing to point at: a sketch centred in a tall slot leaves hundreds of
 * empty pixels above and below it, so an emphasis sized to the region misses
 * the drawing by a wide margin, encloses whatever else shares the slot, and
 * frequently runs off the board.
 *
 * So anything that points at something else — emphasis, arrows, a caption that
 * wants to sit under a picture — asks here instead, and gets the box the ink
 * really occupies.
 *
 * Strokes are measured from the same samples the pen schedule follows, so the
 * box is the path the hand will trace and not an approximation of it. Text is
 * measured per row, because a wrapped title's last line is usually far narrower
 * than the block, and an underline drawn at block width underlines nothing.
 */

import type { Box } from "@/lib/engine/board";
import type { Part, StrokePart, TextPart } from "@/lib/engine/parts";
import { samplePath } from "@/lib/engine/path-sampling";
import { WRITING_LINE } from "@/lib/engine/text";

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export const boxArea = (box: Box) => Math.max(0, box.w) * Math.max(0, box.h);

export function boxesOverlap(a: Box, b: Box, tolerance = 0): boolean {
  return (
    a.x < b.x + b.w - tolerance &&
    b.x < a.x + a.w - tolerance &&
    a.y < b.y + b.h - tolerance &&
    b.y < a.y + a.h - tolerance
  );
}

export function insetBox(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 };
}

/* -------------------------------------------------------------------------- */
/*                                   Strokes                                  */
/* -------------------------------------------------------------------------- */

/**
 * The box a stroke part's paths occupy on the board.
 *
 * `null` when nothing could be measured — no DOM yet on the server's first
 * pass, or a path Rough.js produced that the sampler could not read. Callers
 * fall back to the frame, which is what the engine did everywhere before.
 */
export function strokeBounds(part: StrokePart): Box | null {
  const sx = part.frame.w / (part.viewBox.w || 1);
  const sy = part.frame.h / (part.viewBox.h || 1);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const d of part.paths) {
    for (const point of samplePath(d).points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (!Number.isFinite(minX)) return null;

  // Half the marker's width sticks out either side of the centre line, and it
  // is real ink: a 7px marker on a 60px badge is not a rounding error.
  const pad = (part.strokeWidth * (sx + sy)) / 4;

  return {
    x: part.frame.x + minX * sx - pad,
    y: part.frame.y + minY * sy - pad,
    w: (maxX - minX) * sx + pad * 2,
    h: (maxY - minY) * sy + pad * 2,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Text                                    */
/* -------------------------------------------------------------------------- */

/**
 * One box per wrapped line, each hugging the words actually on it.
 *
 * The line box is trimmed to the part of it glyphs really use: from a little
 * above the writing line by roughly a cap height, down to just under it. A full
 * `lineHeight` box is mostly leading, and anything that hugs it sits visibly
 * too far from the words.
 */
export function textRowBounds(part: TextPart): Box[] {
  const { layout } = part;
  const baseline = layout.lineHeight * WRITING_LINE;

  return layout.rows.map((row) => {
    const words = row.words.map((index) => layout.words[index]);
    const left = Math.min(...words.map((word) => word.x));
    const right = Math.max(...words.map((word) => word.x + word.width));
    const top = part.y + row.y + baseline - part.fontSize * CAP_RATIO;

    return {
      x: part.x + left,
      y: top,
      w: Math.max(0, right - left),
      h: part.fontSize * (CAP_RATIO + DESCENDER_RATIO),
    };
  });
}

/** Cap height as a fraction of the font size, for a handwriting face. */
const CAP_RATIO = 0.72;
/** How far below the writing line descenders reach, likewise. */
const DESCENDER_RATIO = 0.24;

/**
 * Where the writing line of a text part's last row sits, in board pixels.
 * An underline belongs just under this, not under the block.
 */
export function lastWritingLine(part: TextPart): number {
  const { layout } = part;
  const lastRow = layout.rows[layout.rows.length - 1];
  return part.y + (lastRow?.y ?? 0) + layout.lineHeight * WRITING_LINE;
}

export function textBounds(part: TextPart): Box | null {
  return textRowBounds(part).reduce<Box | null>((box, row) => unionBox(box, row), null);
}

/* -------------------------------------------------------------------------- */
/*                                   Parts                                    */
/* -------------------------------------------------------------------------- */

export function partBounds(part: Part): Box | null {
  return part.kind === "text" ? textBounds(part) : strokeBounds(part);
}

/** The union of everything a set of parts inks. */
export function partsBounds(parts: Part[]): Box | null {
  return parts.reduce<Box | null>((box, part) => unionBox(box, partBounds(part)), null);
}

/**
 * The ink of a set of parts, or the region they were laid out in when nothing
 * could be measured. Never returns null, so callers stay simple.
 */
export function inkOrRegion(parts: Part[], region: Box): Box {
  return partsBounds(parts) ?? region;
}
