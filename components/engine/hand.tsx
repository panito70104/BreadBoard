"use client";

import { getHand, type HandTool } from "@/data/hands";
import { BOARD } from "@/lib/engine/board";
import { clamp, tremor } from "@/lib/engine/motion";

/** The hand covers roughly this much of the board height. */
const HAND_HEIGHT_RATIO = 0.46;

/** Degrees of wrist rotation at a full vertical stroke. */
const STROKE_TILT = 7;
/** Degrees between writing at the left edge of the board and at the right. */
const PLACE_TILT = 4;
const MAX_TILT = 10;

/** Pixels and degrees of tremor. A hand that is perfectly still is a sprite. */
const TREMOR_SHIFT = 1.2;
const TREMOR_TURN = 0.35;

export interface HandProps {
  /** Board coordinates the tool tip must land on. */
  x: number;
  y: number;
  /** Direction the tip is travelling, in radians. */
  angle?: number;
  /** 0 with the tip on the board, 1 fully in the air. */
  lift?: number;
  /** Board pixels per second, for motion blur. */
  speed?: number;
  /** Absolute frame — the tremor has to be a pure function of it. */
  frame?: number;
  tool?: HandTool;
  family?: number;
  opacity?: number;
  /**
   * Prefix for the image URL.
   *
   * Next serves `public/hands/x.webp` at `/hands/x.webp`; Remotion's headless
   * bundle serves the same file at `/public/hands/x.webp`. The asset table
   * keeps the Next path, and the Remotion entry says where it really is.
   */
  srcBase?: string;
}

/**
 * Positions the hand so its calibrated contact point sits exactly on (x, y).
 *
 * It also rotates, which the engine used to refuse to do on the grounds that
 * the anchor drifts. It only drifts if you rotate about the centre: with the
 * transform origin on the contact point, the tip is the fixed point of the
 * rotation by definition, and the hand can tilt into its stroke the way a wrist
 * does. That, the tremor and the lift are most of what separates a hand that is
 * drawing from a photograph being slid around.
 *
 * None of this touches the ink. The tremor is the hand's alone; applied to the
 * strokes it would boil at thirty frames a second.
 */
export function Hand({
  x,
  y,
  angle = 0,
  lift = 0,
  speed = 0,
  frame = 0,
  tool = "marker",
  family,
  opacity = 1,
  srcBase = "",
}: HandProps) {
  if (opacity <= 0.01) return null;

  const asset = getHand(tool, family);
  const height = BOARD.height * HAND_HEIGHT_RATIO;
  const width = (asset.width / asset.height) * height;

  // Down-stroke rolls the wrist over, up-stroke rolls it back; the further
  // left on the board, the more the whole forearm is turned to reach it. In
  // the air the wrist relaxes towards neutral.
  const settled = 1 - lift * 0.6;
  const tilt = clamp(
    Math.sin(angle) * STROKE_TILT * settled +
      (x / BOARD.width - 0.5) * PLACE_TILT +
      tremor(frame, 11.3) * TREMOR_TURN,
    -MAX_TILT,
    MAX_TILT,
  );

  const shiftX = tremor(frame, 2.7) * TREMOR_SHIFT;
  const shiftY = tremor(frame, 7.1) * TREMOR_SHIFT;
  const blur = Math.min(2.4, (speed / 1400) * lift);

  // A plain <img>: next/image's loader and lazy behaviour would fight the
  // frame-accurate render Remotion needs, and the asset is already sized.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${srcBase}${asset.src}`}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        width,
        height,
        left: x - asset.anchorRatio.x * width + shiftX,
        top: y - asset.anchorRatio.y * height + shiftY,
        opacity,
        pointerEvents: "none",
        // The contact point is the pivot, so rotating and scaling cannot move
        // the tip off the stroke.
        transformOrigin: `${asset.anchorRatio.x * 100}% ${asset.anchorRatio.y * 100}%`,
        transform: `rotate(${tilt}deg) scale(${1 + lift * 0.05})`,
        // Lifting separates the hand from its shadow and softens it, which is
        // the only cue that says the marker is off the board.
        filter:
          `blur(${blur.toFixed(2)}px) ` +
          `drop-shadow(0 ${18 + lift * 26}px ${24 + lift * 30}px rgba(12, 18, 34, ${(0.18 - lift * 0.05).toFixed(3)}))`,
      }}
    />
  );
}
