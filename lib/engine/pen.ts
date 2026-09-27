/**
 * The pen schedule: when the marker is on the board, and when it is in the air.
 *
 * A step is not one continuous stroke. An icon is a dozen separate paths, a
 * paragraph is several lines, and between any two of them a real marker leaves
 * the board, travels, and comes back down. The engine used to skip all of that:
 * the tip teleported from the end of one path to the start of the next, twelve
 * times inside a single drawing. It is the most mechanical thing a whiteboard
 * video can do, and no amount of wobble in the ink hides it.
 *
 * So a step is planned as a sequence of events — draw, travel, draw — each with
 * real seconds on it. Drawing time comes from how long the stroke is; travel
 * time comes from how far the hand has to reach, never from how much room the
 * narration happens to leave. The ink and the hand read the same schedule.
 *
 * The consequence worth knowing: a step can finish before its slot ends. That
 * is deliberate. A person writes at their own speed and then waits; they do not
 * slow their handwriting down to fill a pause.
 */

import {
  REACH,
  arcControl,
  bezier,
  bezierAngle,
  clamp,
  clamp01,
  distance,
  reachEase,
  reachSeconds,
  smoothstep,
  type Point,
} from "@/lib/engine/motion";
import { pointAt, samplePath } from "@/lib/engine/path-sampling";
import type { Part, StrokePart, TextPart } from "@/lib/engine/parts";
import { sliceCount } from "@/lib/engine/parts";
import { WRITING_LINE, wordPen } from "@/lib/engine/text";
import type { TimedStep } from "@/lib/engine/timeline";

/** Board pixels a marker covers in a second while drawing a line. */
const DRAW_SPEED = 1150;
/** Seconds per character of handwriting. */
const WRITE_SECONDS = 0.055;
/** Weight of the beat after a word, in characters. The pen is still moving. */
const SPACE_WEIGHT = 1.4;
const MIN_STROKE_SECONDS = 0.1;
const MIN_LINE_SECONDS = 0.25;
/** Below this the marker just slides; lifting it would be a twitch. */
const LIFT_THRESHOLD = 3;
/** Distance at which a hop becomes a full lift. */
const FULL_LIFT = 700;
/** Handwriting runs slightly uphill; the hand barely tilts for it. */
const SCRIPT_ANGLE = -0.12;
/** Step used to differentiate position into a speed. */
const SPEED_STEP = 0.03;

interface Timed {
  /** Seconds from the start of the step. */
  at: number;
  seconds: number;
}

interface DrawEvent extends Timed {
  kind: "draw";
  part: number;
  point: (local: number) => Point;
  angle: (local: number) => number;
  /** Writes this event's share into the part's slice array. */
  ink: (local: number, into: number[]) => void;
}

interface TravelEvent extends Timed {
  kind: "travel";
  from: Point;
  control: Point;
  to: Point;
  lift: number;
}

type PenEvent = DrawEvent | TravelEvent;

export interface PenPlan {
  events: PenEvent[];
  /** Seconds the step wants, drawing and travelling, at a human pace. */
  seconds: number;
  /** Progress values each part needs: one per path, or one per word. */
  sliceCounts: number[];
}

export interface PenState {
  x: number;
  y: number;
  /** Direction of travel, in radians, screen space. */
  angle: number;
  /** 0 with the tip on the board, 1 fully in the air. */
  lift: number;
  /** Board pixels per second — what motion blur and hand tilt read. */
  speed: number;
  /** Per part, how much of each path (or word) is inked. */
  slices: number[][];
}

export const EMPTY_PEN: PenPlan = { events: [], seconds: 0, sliceCounts: [] };

/* -------------------------------------------------------------------------- */
/*                                   Units                                    */
/* -------------------------------------------------------------------------- */

/** One uninterrupted piece of drawing: a path, or a written line. */
interface Unit {
  part: number;
  seconds: number;
  start: Point;
  end: Point;
  point: (local: number) => Point;
  angle: (local: number) => number;
  ink: (local: number, into: number[]) => void;
}

function strokeUnits(part: StrokePart, index: number): Unit[] {
  const sx = part.frame.w / (part.viewBox.w || 1);
  const sy = part.frame.h / (part.viewBox.h || 1);
  const scale = (sx + sy) / 2;
  const centre = {
    x: part.frame.x + part.frame.w / 2,
    y: part.frame.y + part.frame.h / 2,
  };

  return part.paths.map((d, pathIndex) => {
    const sampled = samplePath(d);
    const known = sampled.points.length > 0;
    const toBoard = (point: Point) => ({
      x: part.frame.x + point.x * sx,
      y: part.frame.y + point.y * sy,
    });
    // A stroke eases in and out of its own length; it has no ballistic phase.
    const at = (local: number) =>
      known ? toBoard(pointAt(sampled, smoothstep(local))) : centre;

    return {
      part: index,
      seconds: Math.max(MIN_STROKE_SECONDS, (sampled.length * scale) / DRAW_SPEED),
      start: at(0),
      end: at(1),
      point: at,
      // Differentiated in board space, so a frame that scales the two axes
      // differently still gives the hand the angle the viewer sees.
      angle: (local: number) => {
        if (!known) return 0;
        const ratio = smoothstep(local);
        const before = toBoard(pointAt(sampled, ratio - 0.02));
        const after = toBoard(pointAt(sampled, ratio + 0.02));
        return Math.atan2(after.y - before.y, after.x - before.x);
      },
      ink: (local: number, into: number[]) => {
        into[pathIndex] = smoothstep(local);
      },
    };
  });
}

/**
 * One unit per written line. The carriage return between them becomes a real
 * travel, which is the movement that most clearly says "a person is writing
 * this" — and it was previously a teleport back across the whole block.
 */
function textUnits(part: TextPart, index: number): Unit[] {
  const { layout } = part;
  const baseline = layout.lineHeight * WRITING_LINE;

  return layout.rows.map((row) => {
    const words = row.words.map((wordIndex) => layout.words[wordIndex]);
    const weights = words.map((word) => Math.max(1, word.text.length) + SPACE_WEIGHT);
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    const y = part.y + row.y + baseline;

    // Each word owns [start, written]; the gap up to [end] is the beat after it.
    let cursor = 0;
    const windows = weights.map((weight) => {
      const start = cursor / total;
      const written = (cursor + weight - SPACE_WEIGHT) / total;
      cursor += weight;
      return { start, written, end: cursor / total };
    });

    const at = (local: number): Point => {
      const t = clamp01(local);
      for (let i = 0; i < words.length; i += 1) {
        const { start, written, end } = windows[i];
        const word = words[i];
        if (t <= written) {
          const inside = written > start ? (t - start) / (written - start) : 1;
          return { x: part.x + word.x + wordPen(word, clamp01(inside)), y };
        }
        if (t < end && i + 1 < words.length) {
          const slide = smoothstep((t - written) / (end - written || 1));
          const from = part.x + word.x + word.width;
          const to = part.x + words[i + 1].x;
          return { x: from + (to - from) * slide, y };
        }
      }
      const last = words[words.length - 1];
      return { x: part.x + last.x + last.width, y };
    };

    return {
      part: index,
      seconds: Math.max(MIN_LINE_SECONDS, total * WRITE_SECONDS),
      start: at(0),
      end: at(1),
      point: at,
      angle: () => SCRIPT_ANGLE,
      ink: (local: number, into: number[]) => {
        const t = clamp01(local);
        row.words.forEach((wordIndex, i) => {
          const { start, written } = windows[i];
          into[wordIndex] = written > start ? clamp01((t - start) / (written - start)) : 1;
        });
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Schedule                                  */
/* -------------------------------------------------------------------------- */

export function planPen(parts: Part[]): PenPlan {
  const units: Unit[] = [];
  const sliceCounts = parts.map(sliceCount);

  parts.forEach((part, index) => {
    units.push(
      ...(part.kind === "text" ? textUnits(part, index) : strokeUnits(part, index)),
    );
  });

  const events: PenEvent[] = [];
  let at = 0;
  let tip: Point | null = null;

  for (const unit of units) {
    if (tip) {
      const gap = distance(tip, unit.start);
      if (gap > LIFT_THRESHOLD) {
        const seconds = reachSeconds(gap, REACH.stroke);
        events.push({
          kind: "travel",
          at,
          seconds,
          from: tip,
          control: arcControl(tip, unit.start, 0.14),
          to: unit.start,
          lift: clamp(gap / FULL_LIFT, 0.2, 1),
        });
        at += seconds;
      }
    }

    events.push({
      kind: "draw",
      at,
      seconds: unit.seconds,
      part: unit.part,
      point: unit.point,
      angle: unit.angle,
      ink: unit.ink,
    });
    at += unit.seconds;
    tip = unit.end;
  }

  return { events, seconds: at, sliceCounts };
}

/** Every slice inked — what a step that finished drawing looks like. */
export function finishedSlices(plan: PenPlan): number[][] {
  return plan.sliceCounts.map((count) => new Array<number>(count).fill(1));
}

export function penStateAt(plan: PenPlan, progress: number): PenState {
  const slices = plan.sliceCounts.map((count) => new Array<number>(count).fill(0));
  if (plan.events.length === 0) {
    return { x: 0, y: 0, angle: 0, lift: 0, speed: 0, slices };
  }

  const time = clamp01(progress) * plan.seconds;

  let active = -1;
  for (let i = 0; i < plan.events.length; i += 1) {
    const event = plan.events[i];
    if (time < event.at + event.seconds) {
      active = i;
      break;
    }
    if (event.kind === "draw") event.ink(1, slices[event.part]);
  }

  // Past the end: the drawing is complete and the tip rests where it finished.
  if (active === -1) {
    const last = plan.events[plan.events.length - 1];
    const point = last.kind === "draw" ? last.point(1) : last.to;
    const angle =
      last.kind === "draw"
        ? last.angle(1)
        : bezierAngle(last.from, last.control, last.to, 1);
    return { x: point.x, y: point.y, angle, lift: 0, speed: 0, slices };
  }

  const event = plan.events[active];
  const local = event.seconds > 0 ? clamp01((time - event.at) / event.seconds) : 1;

  if (event.kind === "draw") {
    event.ink(local, slices[event.part]);
    const here = event.point(local);
    const behind = event.point(Math.max(0, local - SPEED_STEP));
    const ahead = event.point(Math.min(1, local + SPEED_STEP));
    return {
      x: here.x,
      y: here.y,
      angle: event.angle(local),
      lift: 0,
      speed: distance(behind, ahead) / (2 * SPEED_STEP * event.seconds || 1),
      slices,
    };
  }

  const eased = reachEase(local);
  const here = bezier(event.from, event.control, event.to, eased);
  return {
    x: here.x,
    y: here.y,
    angle: bezierAngle(event.from, event.control, event.to, eased),
    // Up and back down over the hop.
    lift: Math.sin(Math.PI * local) * event.lift,
    speed: distance(event.from, event.to) / (event.seconds || 1),
    slices,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Frames to progress                            */
/* -------------------------------------------------------------------------- */

/**
 * Where the pen is in its own schedule at a given frame.
 *
 * The pen never slows below its natural pace to fill a slot: given more room
 * than the drawing needs, it finishes and the hand waits. It only compresses
 * when the narration leaves less room than the drawing honestly takes.
 */
export function penFrames(timed: TimedStep, plan: PenPlan, fps: number): number {
  const span = timed.durationInFrames;
  if (plan.seconds <= 0) return Math.max(1, span);
  return clamp(Math.round(plan.seconds * fps), 1, Math.max(1, span));
}

export function penProgress(
  frame: number,
  timed: TimedStep,
  plan: PenPlan,
  fps: number,
): number {
  const frames = penFrames(timed, plan, fps);
  // Landing on 1 at the last frame the step is active, rather than just short
  // of it, is what stops the final sliver of a stroke popping in on its own.
  return clamp01((frame - timed.from) / Math.max(1, frames - 1));
}

/** The frame the marker lifts off for good — which is when the hand is free. */
export function penEndFrame(timed: TimedStep, plan: PenPlan, fps: number): number {
  return timed.from + penFrames(timed, plan, fps);
}
