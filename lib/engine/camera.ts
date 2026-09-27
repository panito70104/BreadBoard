/**
 * The camera over the board.
 *
 * A whiteboard video shot as one locked-off wide angle is a slideshow: the
 * frame says nothing about where to look, and a 1920px board means the writing
 * is small. A real one drifts toward whatever is being drawn and pulls back as
 * the board fills up.
 *
 * The move is deliberately small. Anything more than a fifth of a zoom starts
 * to swim, and a camera that reacts to every step is worse than one that never
 * moves — so a shot is only kept when it differs enough from the one before it
 * to be worth the movement, and each move starts slightly before the hand
 * arrives, so the new area is already on screen when the drawing begins.
 */

import { BOARD, type Box } from "@/lib/engine/board";
import { clamp, clamp01, lerp, minJerk } from "@/lib/engine/motion";

/** How far in the camera is ever allowed to go. */
const MAX_ZOOM = 1.18;
/** How much the framing is relaxed back toward the whole board. */
const RELAX = 0.3;
/** Padding around the ink, in board pixels. */
const PAD = 90;

/** A move is only worth making past these. */
const SCALE_STEP = 0.02;
const CENTRE_STEP = 70;

const LEAD_SECONDS = 0.35;
const MOVE_SECONDS = 0.9;

export interface CameraShot {
  /** Frame the shot belongs to. */
  at: number;
  /** Ink the frame should contain. */
  focus: Box;
}

export interface CameraKey {
  at: number;
  scale: number;
  /** Board point held at the centre of the frame. */
  cx: number;
  cy: number;
}

export interface CameraFrame {
  scale: number;
  x: number;
  y: number;
}

export const STILL: CameraFrame = { scale: 1, x: 0, y: 0 };

function frameFor(focus: Box): { scale: number; cx: number; cy: number } {
  // Pad, then relax back toward the full board so the framing never clamps
  // down on one word. Relaxing this way pulls the centre toward the middle of
  // the board too, which is what keeps the movement gentle.
  const x = lerp(focus.x - PAD, 0, RELAX);
  const y = lerp(focus.y - PAD, 0, RELAX);
  const w = lerp(focus.w + PAD * 2, BOARD.width, RELAX);
  const h = lerp(focus.h + PAD * 2, BOARD.height, RELAX);

  const scale = clamp(Math.min(BOARD.width / w, BOARD.height / h), 1, MAX_ZOOM);
  return { scale, cx: x + w / 2, cy: y + h / 2 };
}

export function planCamera(shots: CameraShot[]): CameraKey[] {
  const keys: CameraKey[] = [];

  for (const shot of shots) {
    const key = { at: shot.at, ...frameFor(shot.focus) };
    const last = keys[keys.length - 1];
    if (
      last &&
      Math.abs(last.scale - key.scale) < SCALE_STEP &&
      Math.hypot(last.cx - key.cx, last.cy - key.cy) < CENTRE_STEP
    ) {
      continue;
    }
    keys.push(key);
  }

  return keys;
}

/** A hair of scale that never settles, so the frame is never quite frozen. */
const breathe = (frame: number) => 0.004 * (0.5 + 0.5 * Math.sin(frame * 0.017));

export function cameraAt(keys: CameraKey[], frame: number, fps: number): CameraFrame {
  if (keys.length === 0) return STILL;

  const lead = fps * LEAD_SECONDS;
  const move = fps * MOVE_SECONDS;

  let index = 0;
  for (let i = 0; i < keys.length; i += 1) {
    if (frame >= keys[i].at - lead) index = i;
  }

  const target = keys[index];
  const previous = keys[Math.max(0, index - 1)];
  const t = index === 0 ? 1 : clamp01((frame - (target.at - lead)) / move);
  const eased = minJerk(t);

  const scale = lerp(previous.scale, target.scale, eased) + breathe(frame);
  const cx = lerp(previous.cx, target.cx, eased);
  const cy = lerp(previous.cy, target.cy, eased);

  // Hold (cx, cy) at the centre of the frame, without letting the board's own
  // edges come into view.
  return {
    scale,
    x: clamp(BOARD.width / 2 - cx * scale, BOARD.width * (1 - scale), 0),
    y: clamp(BOARD.height / 2 - cy * scale, BOARD.height * (1 - scale), 0),
  };
}
