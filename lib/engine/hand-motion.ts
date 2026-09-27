/**
 * Where the hand is at any frame.
 *
 * While a step is being drawn the answer comes straight from its pen schedule.
 * Between steps it has to be invented, and that is where a whiteboard video is
 * usually given away: the old engine stretched the movement to fill whatever
 * pause the narration left, so the hand crawled across a short gap and the
 * writing it had just finished stayed hidden under it the whole time.
 *
 * A person does neither. They finish, look at it for a moment, move at the
 * speed the distance deserves, and then wait — out of the way, so the writing
 * can be read. Given long enough they take their hand off the board entirely
 * and bring it back just before the next stroke.
 *
 * This lives in the engine rather than in the composition because it is pure
 * arithmetic over the plan, and because it is the part most worth testing.
 */

import { BOARD } from "@/lib/engine/board";
import {
  REACH,
  arcControl,
  bezier,
  bezierAngle,
  clamp,
  clamp01,
  distance,
  drift,
  reachEase,
  reachSeconds,
  type Point,
} from "@/lib/engine/motion";
import { penEndFrame, penProgress, penStateAt, type PenState } from "@/lib/engine/pen";
import type { PlacedStep, ScenePlan } from "@/lib/engine/plan";
import { stepProgress } from "@/lib/engine/timeline";

/** How long the hand stays where it finished, looking at it. */
const SETTLE_SECONDS = 0.22;
/** How early it arrives at the next stroke. */
const ARRIVE_SECONDS = 0.12;
/** Idle time past which it is worth leaving the board entirely. */
const LEAVE_AFTER_SECONDS = 1.5;
/** How far the hand drifts while it waits, in board pixels. */
const WAIT_DRIFT = 2.5;
/** How high it hovers over the next stroke while it waits for the cue. */
const HOVER = 0.12;

export interface HandState {
  x: number;
  y: number;
  /** Direction of travel, in radians. */
  angle: number;
  /** 0 with the tip on the board, 1 fully in the air. */
  lift: number;
  /** Board pixels per second. */
  speed: number;
  tool: "marker" | "eraser";
}

export interface StageState {
  /** Null while the hand is off the board entirely. */
  hand: HandState | null;
  /** The step being drawn right now, if any. */
  active: PlacedStep | null;
  /** How far into that step's ink the marker is. */
  pen: PenState | null;
}

/**
 * Board coordinates of the eraser as it sweeps the area it clears.
 *
 * It zigzags across while descending continuously. Stepping the rows down one
 * at a time, as this used to, jumped the hand a third of the erased area in a
 * single frame — three times per wipe.
 */
export function eraseHead(placed: PlacedStep, progress: number): Point {
  const { x, y, w, h } = placed.bounds;
  const rows = 3;
  const travelled = clamp01(progress) * rows;
  const row = Math.min(rows - 1, Math.floor(travelled));
  const along = travelled - row;
  return {
    x: x + w * (row % 2 === 0 ? along : 1 - along),
    y: y + (h * (0.5 + clamp01(progress) * (rows - 1))) / rows,
  };
}

const toolOf = (step: PlacedStep): "marker" | "eraser" =>
  step.element.type === "erase" ? "eraser" : "marker";

/** Where a step's ink begins and ends, which is where the hand has to be. */
function headOfStep(step: PlacedStep, at: 0 | 1): Point {
  if (step.element.type === "erase") return eraseHead(step, at);
  const pen = penStateAt(step.pen, at);
  return { x: pen.x, y: pen.y };
}

/** The frame the marker lifts off a step for good. */
export function endFrameOf(step: PlacedStep, fps: number): number {
  return step.element.type === "erase"
    ? step.timed.from + step.timed.durationInFrames
    : penEndFrame(step.timed, step.pen, fps);
}

/** Just off the board, below and to the right — where the arm already is. */
function restPoint(near: Point): Point {
  return { x: clamp(near.x + 150, 340, BOARD.width - 240), y: BOARD.height + 240 };
}

/** A hand waiting is not a hand frozen. */
function waitingAt(at: Point, frame: number, lift: number) {
  return {
    x: at.x + drift(frame, 3.3) * WAIT_DRIFT,
    y: at.y + drift(frame, 8.9) * WAIT_DRIFT,
    angle: 0,
    lift,
    speed: 0,
  };
}

function travellingBetween(
  from: Point,
  to: Point,
  start: number,
  frames: number,
  frame: number,
  fps: number,
) {
  const t = clamp01(frames > 0 ? (frame - start) / frames : 1);
  const control = arcControl(from, to, 0.18);
  const eased = reachEase(t);
  const point = bezier(from, control, to, eased);
  return {
    x: point.x,
    y: point.y,
    angle: bezierAngle(from, control, to, eased),
    // Up and back down over the reach.
    lift: Math.sin(Math.PI * t),
    speed: distance(from, to) / (frames / fps || 1),
  };
}

function handBetween(
  frame: number,
  previous: PlacedStep | undefined,
  next: PlacedStep | undefined,
  fps: number,
): HandState | null {
  if (!previous && !next) return null;

  // Coming into the scene: enter from off the board, arriving just in time.
  if (!previous && next) {
    const to = headOfStep(next, 0);
    const rest = restPoint(to);
    const reach = reachSeconds(distance(rest, to), REACH.element) * fps;
    const start = next.timed.from - ARRIVE_SECONDS * fps - reach;

    if (frame < start) return null;
    if (frame < start + reach) {
      return { ...travellingBetween(rest, to, start, reach, frame, fps), tool: toolOf(next) };
    }
    return { ...waitingAt(to, frame, HOVER), tool: toolOf(next) };
  }

  // Leaving the scene: settle, then take the hand off the board for good.
  if (previous && !next) {
    const from = headOfStep(previous, 1);
    const settled = endFrameOf(previous, fps) + SETTLE_SECONDS * fps;
    const rest = restPoint(from);
    const reach = reachSeconds(distance(from, rest), REACH.element) * fps;

    if (frame < settled) return { ...waitingAt(from, frame, 0), tool: toolOf(previous) };
    if (frame < settled + reach) {
      return {
        ...travellingBetween(from, rest, settled, reach, frame, fps),
        tool: toolOf(previous),
      };
    }
    return null;
  }

  const before = previous!;
  const after = next!;
  const from = headOfStep(before, 1);
  const to = headOfStep(after, 0);
  const opens = endFrameOf(before, fps);
  const closes = after.timed.from;
  const gap = Math.max(1, closes - opens);

  // A pause shorter than the movement it contains has to give somewhere. The
  // reach keeps what it can and the pause afterwards pays for it, because a
  // hand that arrives late is behind its own ink, which is unforgivable, while
  // a hand that does not linger is merely brisk.
  const wanted = reachSeconds(distance(from, to), REACH.element) * fps;
  const reach = Math.min(wanted, gap);
  const settle = Math.min(SETTLE_SECONDS * fps, gap * 0.3, gap - reach);

  const idle = gap - settle - reach;

  // Long enough to be worth getting out of the way: go and come back.
  if (idle > LEAVE_AFTER_SECONDS * fps) {
    const rest = restPoint(from);
    const out = reachSeconds(distance(from, rest), REACH.element) * fps;
    const back = reachSeconds(distance(rest, to), REACH.element) * fps;
    const backStart = closes - ARRIVE_SECONDS * fps - back;

    if (opens + settle + out + 0.25 * fps <= backStart) {
      if (frame < opens + settle) {
        return { ...waitingAt(from, frame, 0), tool: toolOf(before) };
      }
      if (frame < opens + settle + out) {
        return {
          ...travellingBetween(from, rest, opens + settle, out, frame, fps),
          tool: toolOf(before),
        };
      }
      if (frame < backStart) return null;
      if (frame < backStart + back) {
        return {
          ...travellingBetween(rest, to, backStart, back, frame, fps),
          tool: toolOf(after),
        };
      }
      return { ...waitingAt(to, frame, HOVER), tool: toolOf(after) };
    }
  }

  if (frame < opens + settle) return { ...waitingAt(from, frame, 0), tool: toolOf(before) };
  if (frame < opens + settle + reach) {
    return {
      ...travellingBetween(from, to, opens + settle, reach, frame, fps),
      tool: toolOf(after),
    };
  }
  return { ...waitingAt(to, frame, HOVER), tool: toolOf(after) };
}

/** Room to leave before the first step, which the hand enters from off-board. */
const OPENING_SECONDS = 0.3;

/**
 * Seconds of board time each step needs before it can start drawing: the beat
 * after the previous stroke plus the reach from where it ended.
 *
 * The timeline used to leave a flat gap between every pair of steps, which is
 * either far too much for two bullets stacked on each other or far too little
 * to get from one corner of the board to the other — and when it is too
 * little, the hand crosses the board in three frames, which looks like a
 * dropped shot. With the geometry planned, the real distance is known.
 */
export function approachSeconds(steps: PlacedStep[], minimum: number): number[] {
  const drawing = steps.filter(
    (step) => step.parts.length > 0 || step.element.type === "erase",
  );

  return steps.map((step) => {
    const at = drawing.indexOf(step);
    if (at <= 0) return at === 0 ? OPENING_SECONDS : minimum;
    const from = headOfStep(drawing[at - 1], 1);
    const to = headOfStep(step, 0);
    return Math.max(
      minimum,
      SETTLE_SECONDS + reachSeconds(distance(from, to), REACH.element),
    );
  });
}

/**
 * The marker, the hand and the ink at one frame — worked out once, because
 * they are the same marker and must not be derived twice.
 */
export function stageAt(frame: number, plan: ScenePlan, fps: number): StageState {
  const drawing = plan.steps.filter(
    (step) => step.parts.length > 0 || step.element.type === "erase",
  );

  const active =
    drawing.find((step) => frame >= step.timed.from && frame < endFrameOf(step, fps)) ?? null;

  if (active && active.element.type === "erase") {
    const head = eraseHead(active, stepProgress(frame, active.timed));
    return {
      hand: { ...head, angle: 0, lift: 0, speed: 0, tool: "eraser" },
      active,
      pen: null,
    };
  }

  if (active) {
    const pen = penStateAt(active.pen, penProgress(frame, active.timed, active.pen, fps));
    return {
      hand: { x: pen.x, y: pen.y, angle: pen.angle, lift: pen.lift, speed: pen.speed, tool: "marker" },
      active,
      pen,
    };
  }

  return {
    hand: handBetween(
      frame,
      [...drawing].reverse().find((step) => endFrameOf(step, fps) <= frame),
      drawing.find((step) => step.timed.from > frame),
      fps,
    ),
    active: null,
    pen: null,
  };
}
