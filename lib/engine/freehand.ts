/**
 * Strokes with a marker's thickness instead of a pen plotter's.
 *
 * A real marker does not lay down a constant 7px. It is thin where the tip is
 * moving fast, thicker where it slows, and it tapers at both ends as the nib
 * touches down and leaves. `perfect-freehand` turns a list of points with
 * pressure into the outline of such a stroke; everything interesting here is
 * where the pressure comes from.
 *
 * **It is not simulated from the distance between points.** That is what
 * `simulatePressure` would do, and it would be a lie told twice: the engine
 * already knows exactly how fast the tip is moving, because the pen schedule
 * decided it. A stroke is drawn over `seconds` with a `smoothstep` ease along
 * its own arc length, so the tip's speed at a point is
 *
 *     speed(t) = length / seconds · smoothstep'(t),   smoothstep'(t) = 6t(1-t)
 *
 * — nought at both ends, one and a half times the average in the middle. Slow
 * is thick, fast is thin, and the numbers are the same ones that put the hand
 * on the stroke. The taper at the ends is separate: it is the nib touching down
 * and lifting, and `perfect-freehand` draws it from the `start`/`end` options.
 *
 * Purity: an outline is a function of the path, how much of it is inked, and
 * its schedule. Nothing carries over from the previous frame, which is what
 * lets Remotion render frames in parallel and out of order.
 */

import { getStroke } from "perfect-freehand";

import { clamp } from "@/lib/engine/motion";
import { samplePath, type Point } from "@/lib/engine/path-sampling";

/** Board pixels a marker covers in a second — the same figure `pen.ts` uses. */
const DRAW_SPEED = 1150;

/**
 * How much of the width pressure is allowed to take away.
 *
 * A marker, not a brush: at full speed the line keeps two thirds of its
 * thickness. Past about 0.45 the stroke starts to look like calligraphy, which
 * is a different instrument and reads as decoration.
 */
const PRESSURE_RANGE = 0.34;

/** How much of the width `perfect-freehand` itself varies with pressure. */
const THINNING = 0.38;

/**
 * Length of the taper at each end, as a multiple of the line's width — and the
 * most of the stroke's own length it may ever eat.
 *
 * The cap is not a detail. A sun is a circle and eight rays two units long on
 * the 24-unit grid; a taper of 1.6 widths at each end is longer than the whole
 * ray, and `getStroke` quite reasonably returns nothing at all for it. The sun
 * came out with no light.
 */
const TAPER = 1.6;
const TAPER_MAX_SHARE = 0.22;

/**
 * The most points an outline is built from.
 *
 * Paths are sampled densely for the hand — up to 512 points — and an outline
 * does not need anything like that: the stroke is smoothed anyway, and the cost
 * is paid once per frame on the stroke being drawn.
 */
const MAX_POINTS = 96;

/** Peak of `smoothstep'`, at the middle of the stroke. */
const PEAK_EASE = 1.5;

export type StrokeStyle = "rough" | "freehand";

export const DEFAULT_STROKE_STYLE: StrokeStyle = "rough";

/**
 * Pressure at a point `ratio` of the way along a stroke drawn in `seconds`.
 *
 * `ratio` is distance along the path; the ease is in time, so it has to be
 * inverted first — `smoothstep` is monotonic on [0,1], so a few bisection
 * steps are exact enough and far cheaper than the closed form.
 */
function pressureAt(ratio: number, lengthPx: number, seconds: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 12; i += 1) {
    const mid = (low + high) / 2;
    if (mid * mid * (3 - 2 * mid) < ratio) low = mid;
    else high = mid;
  }
  const t = (low + high) / 2;
  const speed = ((lengthPx / Math.max(seconds, 1e-4)) * (6 * t * (1 - t))) / DRAW_SPEED;
  return clamp(1 - (speed / PEAK_EASE) * PRESSURE_RANGE, 1 - PRESSURE_RANGE, 1);
}

function toPath(outline: number[][]): string {
  if (outline.length === 0) return "";
  // Closed, with each corner rounded through the midpoint of its neighbours —
  // the usual way to render a `getStroke` polygon without visible facets.
  let d = `M${outline[0][0].toFixed(2)},${outline[0][1].toFixed(2)}`;
  for (let i = 0; i < outline.length; i += 1) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `Q${x0.toFixed(2)},${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)},${((y0 + y1) / 2).toFixed(2)}`;
  }
  return `${d}Z`;
}

export interface OutlineSpec {
  /** Line width, in the path's own coordinate space. */
  width: number;
  /** Board pixels one unit of that space becomes — pressure is a board-space idea. */
  unitScale: number;
  /** Seconds the pen schedule gives this stroke. */
  seconds: number;
}

const cache = new Map<string, string>();
const CACHE_LIMIT = 3000;

/** For the benchmark, which needs to measure a cold pass. */
export function clearOutlineCache() {
  cache.clear();
}

/**
 * The outline of the first `share` of a path, as an SVG path to fill.
 *
 * Finished strokes are cached: a scene holds dozens of them on the board and
 * only the one being drawn changes from frame to frame.
 */
export function freehandOutline(d: string, share: number, spec: OutlineSpec): string {
  const done = share >= 0.999;
  const key = done
    ? `${d}|${spec.width.toFixed(3)}|${spec.unitScale.toFixed(3)}|${spec.seconds.toFixed(3)}`
    : "";
  if (done) {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
  }

  const sampled = samplePath(d);
  if (sampled.points.length < 2 || share <= 0) return "";

  /*
   * Everything below is done in board pixels and scaled back at the end.
   *
   * `perfect-freehand` is written for screen coordinates and carries absolute
   * epsilons — the distance below which two points are the same, the minimum
   * segment it will build an outline segment from. An icon is drawn on a
   * 24-unit grid, where a 7px marker is 0.56 units wide and a sun's ray is two
   * units long, and at that magnitude those epsilons swallow the stroke: the
   * outline came back with three points and the sun lost all its light.
   */
  const scale = spec.unitScale;
  const lengthPx = sampled.length * scale;
  const widthPx = spec.width * scale;

  /*
   * A finished stroke is the whole stroke, exactly.
   *
   * The cache is keyed on the path and its schedule, not on `share`, because
   * every finished stroke is the same drawing. That is only true if "finished"
   * means all of it: cache the outline for a share of 0.9995 and it comes back
   * for a share of 1, one sample short, and which of the two got there first
   * depends on the order Remotion happened to render the frames in. Snapping
   * here is what makes the key honest.
   */
  const last = (sampled.points.length - 1) * (done ? 1 : clamp(share, 0, 1));
  const lastIndex = Math.floor(last);
  const step = Math.max(1, Math.ceil((lastIndex + 1) / MAX_POINTS));

  const input: [number, number, number][] = [];
  const push = (point: Point, ratio: number) =>
    input.push([
      point.x * scale,
      point.y * scale,
      pressureAt(ratio, lengthPx, spec.seconds),
    ]);

  for (let i = 0; i <= lastIndex; i += step) {
    push(sampled.points[i], i / (sampled.points.length - 1));
  }
  // The tip's exact position, interpolated — without it the stroke's leading
  // edge would jump between samples as it is drawn.
  if (lastIndex < sampled.points.length - 1) {
    const a = sampled.points[lastIndex];
    const b = sampled.points[lastIndex + 1];
    const t = last - lastIndex;
    push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, last / (sampled.points.length - 1));
  } else if ((lastIndex % step) !== 0) {
    push(sampled.points[lastIndex], 1);
  }

  /*
   * A closed shape gets no taper.
   *
   * On an ellipse or a circle the two ends land on top of each other, so
   * tapering both leaves a notch exactly where the line should be continuous —
   * the one place a viewer reads as a mistake rather than as a hand. A person
   * closing a loop overlaps the start instead of thinning into it.
   */
  const first = sampled.points[0];
  const end = sampled.points[sampled.points.length - 1];
  const closed = Math.hypot(end.x - first.x, end.y - first.y) * scale < widthPx * 2;

  const taper = closed ? 0 : Math.min(widthPx * TAPER, lengthPx * TAPER_MAX_SHARE);

  const outline = getStroke(input, {
    size: widthPx,
    thinning: THINNING,
    smoothing: 0.5,
    streamline: 0.32,
    simulatePressure: false,
    start: { taper, cap: false },
    // While the stroke is still being drawn the leading end is the nib, which
    // is not tapered — it is where the ink is being laid down right now.
    end: done ? { taper, cap: false } : { taper: 0, cap: true },
    last: done,
  });

  // Back into the coordinate space the path — and the SVG's viewBox — is in.
  const result = toPath((outline as number[][]).map(([x, y]) => [x / scale, y / scale]));
  if (done) {
    if (cache.size > CACHE_LIMIT) cache.clear();
    cache.set(key, result);
  }
  return result;
}
