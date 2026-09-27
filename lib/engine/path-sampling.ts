/**
 * Where the marker tip is along an SVG path.
 *
 * The hand has to follow the stroke as it is drawn, so for any progress value
 * we need the point the pen has reached. Browsers expose that exactly through
 * `getPointAtLength`, so we measure against a detached path element and cache
 * the result — the same `d` always yields the same samples, which keeps the
 * hand from jittering between frames.
 *
 * Two things matter more than they look:
 *
 * **Samples are spaced by arc length, not counted.** A fixed count makes a long
 * path advance in visibly bigger steps than a short one.
 *
 * **Positions are interpolated between samples, never snapped to one.** With
 * snapping, the tip sits still for a frame and then jumps, which reads as a
 * tremble that no amount of easing can hide. Interpolating also means the
 * sample count can stay modest: between two samples 6px apart on any curve a
 * hand would draw, the straight line is off by hundredths of a pixel.
 */

import { clamp, clamp01, type Point } from "@/lib/engine/motion";

export type { Point };

export interface SampledPath {
  /** Arc length, in the path's own coordinate space. */
  length: number;
  /** Evenly spaced by arc length; `points[0]` is the start. */
  points: Point[];
}

const cache = new Map<string, SampledPath>();
const CACHE_LIMIT = 4000;

const EMPTY: SampledPath = { length: 0, points: [] };

const sampleCount = (length: number) => Math.round(clamp(length * 3, 48, 512));

export function samplePath(d: string): SampledPath {
  const cached = cache.get(d);
  if (cached) return cached;
  if (typeof document === "undefined") return EMPTY;

  try {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "path");
    element.setAttribute("d", d);
    const length = element.getTotalLength();
    if (!Number.isFinite(length) || length === 0) return EMPTY;

    const count = sampleCount(length);
    const points: Point[] = [];
    for (let i = 0; i <= count; i += 1) {
      const point = element.getPointAtLength((length * i) / count);
      points.push({ x: point.x, y: point.y });
    }

    const sampled = { length, points };
    if (cache.size > CACHE_LIMIT) cache.clear();
    cache.set(d, sampled);
    return sampled;
  } catch {
    return EMPTY;
  }
}

export function pathLengths(paths: string[]): number[] {
  return paths.map((d) => samplePath(d).length);
}

/** The point `ratio` of the way along, interpolated between samples. */
export function pointAt(sampled: SampledPath, ratio: number): Point {
  const { points } = sampled;
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const exact = clamp01(ratio) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(exact));
  const t = exact - index;
  const a = points[index];
  const b = points[index + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Reorders a drawing's paths so each one starts near where the last one ended.
 *
 * Icon sets list their geometry in whatever order the designer drew it in, which
 * is often a zigzag across the shape. The hand follows that order literally, so
 * a notebook gets drawn as spine, page, spine, page. Nearest neighbour from the
 * top-left is roughly what a person does, and it is also the cheapest way to
 * cut the time the marker spends in the air.
 *
 * Paths are never reversed: the direction a stroke is drawn in is part of how
 * it reads, and rewriting a `d` string backwards would flatten its curves.
 */
export function orderPaths(paths: string[]): string[] {
  if (paths.length < 3) return paths;

  const shape = paths.map((d) => {
    const sampled = samplePath(d);
    if (sampled.points.length === 0) return null;
    return { start: sampled.points[0], end: sampled.points[sampled.points.length - 1] };
  });
  // Nothing measurable (no DOM yet): leave the order alone rather than guess.
  if (shape.some((value) => value === null)) return paths;
  const ends = shape as { start: Point; end: Point }[];

  const pending = new Set(paths.map((_, index) => index));
  const order: number[] = [];

  // Start where a person would: the stroke beginning highest and furthest left.
  let tip = ends.reduce(
    (best, value) =>
      value.start.x + value.start.y < best.x + best.y ? value.start : best,
    ends[0].start,
  );

  while (pending.size > 0) {
    let nearest = -1;
    let shortest = Infinity;
    for (const index of pending) {
      const gap = Math.hypot(ends[index].start.x - tip.x, ends[index].start.y - tip.y);
      if (gap < shortest) {
        shortest = gap;
        nearest = index;
      }
    }
    pending.delete(nearest);
    order.push(nearest);
    tip = ends[nearest].end;
  }

  return order.map((index) => paths[index]);
}
