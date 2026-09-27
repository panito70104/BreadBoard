/**
 * Hand-drawn geometry via Rough.js.
 *
 * Lucide icons are geometrically perfect, which reads as clip art on a
 * whiteboard. Rough.js redraws a path with the wobble and overshoot of a real
 * marker, which is what makes stock icons pass as doodles.
 *
 * One stroke per line. Rough.js defaults to two slightly offset passes per
 * line — a pencil-sketch look — and since the hand follows the path, it would
 * trace every line, jump back to the start and trace it again. A marker on a
 * whiteboard draws each line once.
 *
 * The seed comes from the input so a shape looks identical on every frame;
 * otherwise the wobble would re-randomise 30 times a second and the drawing
 * would boil. Results are cached for the same reason and because generating
 * them is not free.
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
const cache = new Map<string, string[]>();
const CACHE_LIMIT = 4000;

export interface RoughOptions {
  roughness?: number;
  bowing?: number;
  strokeWidth?: number;
}

/** Converts one path into its single-stroke, hand-drawn equivalent. */
export function roughPath(d: string, options: RoughOptions = {}): string[] {
  const key = `${d}|${options.roughness ?? ""}|${options.bowing ?? ""}|${options.strokeWidth ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const config: Options = {
    roughness: options.roughness ?? 1,
    bowing: options.bowing ?? 1.2,
    strokeWidth: options.strokeWidth ?? 1.6,
    seed: seedFrom(d),
    disableMultiStroke: true,
    preserveVertices: true,
  };

  let result: string[];
  try {
    result = generator
      .toPaths(generator.path(d, config))
      .map((piece) => piece.d)
      .filter(Boolean);
  } catch {
    // A path Rough.js cannot parse still deserves to be drawn.
    result = [d];
  }

  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, result);
  return result;
}

type Point = readonly [number, number];

/** A hand-drawn polyline drawn in one continuous stroke, in the given order. */
export function roughPolyline(points: Point[], options: RoughOptions = {}): string[] {
  const [first, ...rest] = points;
  const d = `M${first[0]} ${first[1]}` + rest.map(([x, y]) => `L${x} ${y}`).join("");
  return roughPath(d, { bowing: 1.8, ...options });
}

export function roughLine(x1: number, y1: number, x2: number, y2: number, options: RoughOptions = {}) {
  return roughPolyline([[x1, y1], [x2, y2]], { bowing: 2.2, ...options });
}

export function roughRect(x: number, y: number, w: number, h: number, options: RoughOptions = {}) {
  return roughPath(`M${x} ${y}h${w}v${h}h${-w}z`, { bowing: 1, ...options });
}

export function roughEllipse(cx: number, cy: number, rx: number, ry: number, options: RoughOptions = {}) {
  const d = `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  return roughPath(d, options);
}

export function roughQuadratic(
  from: Point,
  control: Point,
  to: Point,
  options: RoughOptions = {},
) {
  return roughPath(`M${from[0]} ${from[1]}Q${control[0]} ${control[1]} ${to[0]} ${to[1]}`, options);
}

/**
 * An arrowhead as one "V" stroke — wing, tip, other wing — the way a person
 * draws it. Two separate wings would each start at the tip, sending the hand
 * back to the tip for the second one.
 */
export function roughArrowhead(tip: Point, from: Point, size = 30, options: RoughOptions = {}) {
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const wing = (offset: number): Point => [
    tip[0] - size * Math.cos(angle - offset),
    tip[1] - size * Math.sin(angle - offset),
  ];
  return roughPolyline([wing(0.5), tip, wing(-0.5)], { bowing: 0.4, ...options });
}
