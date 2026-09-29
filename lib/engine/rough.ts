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

import { clamp } from "@/lib/engine/motion";
import { samplePath } from "@/lib/engine/path-sampling";

/* -------------------------------------------------------------------------- */
/*                                 The wobble                                 */
/* -------------------------------------------------------------------------- */

/**
 * How far the line strays from where it was going, in **board pixels**.
 *
 * Board pixels is the whole point. Rough.js's displacement is absolute in
 * whatever coordinate space the path is written in, and an icon is written on a
 * 24-unit grid and then blown up to fill its slot. A `roughness` of 0.5 on a
 * 583px drawing is therefore 24px of noise on the board — enough to flatten the
 * arcs of a link into a blob — while the same 0.5 on a 120px one is 5px. The
 * same number meant two completely different drawings.
 *
 * A marker's tremor does not grow with the size of what it is drawing, so this
 * is a constant and the local `roughness` is derived from it.
 */
const WOBBLE_PX = 3.2;

/** Units of displacement Rough.js applies per unit of `roughness`. */
const RANDOMNESS_UNITS = 2;

const MIN_ROUGHNESS = 0.02;
const MAX_ROUGHNESS = 1.1;

/**
 * The size of stroke `WOBBLE_PX` is calibrated for, on the board.
 *
 * Amplitude is not quite constant either. A given offset is a different thing
 * on a 300px arc and on a 25px one: on the small one it is a sizeable fraction
 * of the radius and the curve stops closing, which is the second half of what
 * dents the link — its arcs are small relative to the drawing they sit in. So
 * the wobble follows the square root of the stroke's size: it grows, but far
 * slower than the drawing, which is what a hand that is not getting shakier
 * produces.
 */
const WOBBLE_REFERENCE = 110;
const WOBBLE_GAIN = { min: 0.3, max: 1.9 };

/** The longest side of a path, in the coordinate space it is written in. */
function extentOf(d: string): number {
  const { points } = samplePath(d);
  if (points.length === 0) return Infinity;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * The `roughness` that produces `WOBBLE_PX` of board-space wobble on a path
 * written at `unitScale` board pixels per coordinate unit.
 */
function roughnessFor(d: string, unitScale: number): number {
  const extent = extentOf(d) * unitScale;
  const gain = Number.isFinite(extent)
    ? clamp(Math.sqrt(extent / WOBBLE_REFERENCE), WOBBLE_GAIN.min, WOBBLE_GAIN.max)
    : 1;
  const wanted = (WOBBLE_PX * gain) / (RANDOMNESS_UNITS * Math.max(unitScale, 1e-6));
  return clamp(wanted, MIN_ROUGHNESS, MAX_ROUGHNESS);
}

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
  /**
   * Board pixels one unit of this path's coordinate space becomes.
   *
   * Pass it and the roughness is worked out from `WOBBLE_PX` instead of being
   * guessed at — which is what anything drawn on its own grid and then scaled
   * (every icon) has to do. Board-space paths leave it at 1.
   *
   * `bowing` needs no such treatment: Rough.js scales it by the length of the
   * segment, so it is already relative.
   */
  unitScale?: number;
}

/** Converts one path into its single-stroke, hand-drawn equivalent. */
export function roughPath(d: string, options: RoughOptions = {}): string[] {
  const roughness =
    options.roughness ?? roughnessFor(d, options.unitScale ?? 1);

  const key = `${d}|${roughness.toFixed(4)}|${options.bowing ?? ""}|${options.strokeWidth ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const config: Options = {
    roughness,
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
