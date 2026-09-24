/**
 * Hand-drawn geometry via Rough.js.
 *
 * Lucide icons are geometrically perfect, which reads as clip art on a
 * whiteboard. Rough.js re-draws a path with the wobble, overshoot and doubled
 * lines of a real marker, which is what makes 147 stock icons pass as doodles.
 *
 * The seed is derived from the input so a given shape looks identical on every
 * frame — without that, the wobble would re-randomize 30 times a second and the
 * drawing would boil.
 */

import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

function seedFrom(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return hash || 1;
}

const generator = rough.generator();

export interface RoughOptions {
  roughness?: number;
  bowing?: number;
  strokeWidth?: number;
}

/** Converts one path into the wobbly outline paths Rough.js produces. */
export function roughPath(d: string, options: RoughOptions = {}): string[] {
  const config: Options = {
    roughness: options.roughness ?? 1.1,
    bowing: options.bowing ?? 1.4,
    strokeWidth: options.strokeWidth ?? 1.6,
    seed: seedFrom(d),
    disableMultiStroke: false,
    preserveVertices: true,
  };

  try {
    const drawable = generator.path(d, config);
    return generator
      .toPaths(drawable)
      .map((piece) => piece.d)
      .filter(Boolean);
  } catch {
    // A path Rough.js cannot parse still deserves to be drawn.
    return [d];
  }
}

/** A hand-drawn straight line between two points. */
export function roughLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: RoughOptions = {},
): string[] {
  return roughPath(`M${x1} ${y1}L${x2} ${y2}`, { bowing: 2.4, ...options });
}

/** A hand-drawn rectangle, for boxes drawn around things. */
export function roughRect(
  x: number,
  y: number,
  w: number,
  h: number,
  options: RoughOptions = {},
): string[] {
  return roughPath(`M${x} ${y}h${w}v${h}h${-w}z`, { bowing: 1.1, ...options });
}

/** A hand-drawn ellipse, for circling a slot. */
export function roughEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  options: RoughOptions = {},
): string[] {
  const d =
    `M${cx - rx} ${cy}` +
    `a${rx} ${ry} 0 1 0 ${rx * 2} 0` +
    `a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  return roughPath(d, options);
}
