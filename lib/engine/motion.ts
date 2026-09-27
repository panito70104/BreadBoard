/**
 * How a hand moves.
 *
 * Two facts drive everything here.
 *
 * A reach takes the time the distance demands, not the time that happens to be
 * available. The old engine stretched every movement to fill the pause in the
 * narration, so the hand crawled across a 40px gap for a second and a half —
 * which is the exact opposite of what a person does. A person moves fast and
 * then waits.
 *
 * And a reach is not symmetric. It accelerates hard, coasts, and spends most of
 * its time arriving, usually overshooting a little and correcting. That is the
 * minimum-jerk profile, which is what human arms actually produce; a symmetric
 * ease reads as machinery.
 *
 * Everything here is a pure function of its inputs, frame numbers included,
 * because Remotion renders frames out of order and in parallel.
 */

export interface Point {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number) => clamp(value, 0, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Minimum jerk: quick off the mark, long deceleration. Human reaching. */
export function minJerk(t: number): number {
  const c = clamp01(t);
  return c * c * c * (10 - 15 * c + 6 * c * c);
}

/** A gentler, symmetric ease — a marker stroke has no ballistic phase. */
export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/**
 * The same reach, with the overshoot and correction that ends a real one.
 * Landing exactly on the target, once, is what makes a cursor look like a
 * cursor.
 */
const OVERSHOOT = 0.035;
const OVERSHOOT_AT = 0.86;

export function reachEase(t: number): number {
  const c = clamp01(t);
  if (c <= OVERSHOOT_AT) return minJerk(c / OVERSHOOT_AT) * (1 + OVERSHOOT);
  return 1 + OVERSHOOT * (1 - minJerk((c - OVERSHOOT_AT) / (1 - OVERSHOOT_AT)));
}

/**
 * Fitts's law: movement time grows with the log of distance over target size.
 *
 * Two calibrations, because they start from different joints. Hopping between
 * the strokes of one drawing begins at the wrist; going to the next element
 * begins at the shoulder. Neither has a low ceiling, though — a "wrist" hop
 * across a diagram that spans the board is still an arm's length, and capping
 * it turns into a smear.
 */
export interface ReachProfile {
  /** Seconds before distance is even considered. */
  base: number;
  /** Seconds per doubling of the difficulty index. */
  per: number;
  min: number;
  max: number;
}

export const REACH = {
  stroke: { base: 0.05, per: 0.17, min: 0.06, max: 0.75 },
  element: { base: 0.18, per: 0.24, min: 0.22, max: 0.95 },
} as const satisfies Record<string, ReachProfile>;

/** Target tolerance in board pixels: how precisely the tip has to land. */
const TOLERANCE = 260;

export function reachSeconds(travel: number, profile: ReachProfile): number {
  const difficulty = Math.log2(1 + Math.max(0, travel) / TOLERANCE);
  return clamp(profile.base + profile.per * difficulty, profile.min, profile.max);
}

/**
 * Control point for the arc a lifted hand travels along.
 *
 * A hand does not slide in a straight line between two points: it bows out of
 * the board, and the bow grows with the distance. The bow goes up, away from
 * the surface; on a level move that is ambiguous, so it goes right instead,
 * which is where the forearm already is.
 */
export function arcControl(from: Point, to: Point, bow = 0.16): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  let px = -dy / length;
  let py = dx / length;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  if (Math.abs(py) < 0.3 && px < 0) {
    px = -px;
    py = -py;
  }

  const reach = length * bow;
  return {
    x: (from.x + to.x) / 2 + px * reach,
    y: (from.y + to.y) / 2 + py * reach,
  };
}

/** Quadratic Bézier. `t` may pass 1 — that is how the overshoot is drawn. */
export function bezier(from: Point, control: Point, to: Point, t: number): Point {
  const inv = 1 - t;
  return {
    x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
  };
}

export function bezierAngle(from: Point, control: Point, to: Point, t: number): number {
  const dx = 2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x);
  const dy = 2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y);
  return Math.atan2(dy, dx);
}

/**
 * Tremor, in -1..1.
 *
 * A hand is never still. Resting a marker on a board it moves a pixel or two,
 * and that is most of what the eye reads as alive. Three incommensurate sines
 * never visibly repeat and are still a pure function of the frame, which is
 * what a frame-accurate renderer needs. It is applied to the hand only —
 * never to the ink, which would boil.
 */
export function tremor(frame: number, seed: number): number {
  return (
    Math.sin(frame * 0.3701 + seed) * 0.55 +
    Math.sin(frame * 0.8867 + seed * 2.13) * 0.3 +
    Math.sin(frame * 1.7333 + seed * 3.71) * 0.15
  );
}

/** Slower and wider than `tremor`: the drift of a hand waiting to write. */
export function drift(frame: number, seed: number): number {
  return Math.sin(frame * 0.071 + seed) * 0.7 + Math.sin(frame * 0.113 + seed * 1.9) * 0.3;
}
