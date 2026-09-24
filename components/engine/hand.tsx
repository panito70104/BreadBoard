"use client";

import { getHand, type HandTool } from "@/data/hands";
import { BOARD } from "@/lib/engine/board";

/** The hand covers roughly this much of the board height. */
const HAND_HEIGHT_RATIO = 0.46;

export interface HandProps {
  /** Board coordinates the tool tip must land on. */
  x: number;
  y: number;
  tool?: HandTool;
  family?: number;
  /** 0 hides it entirely; used to fade between elements. */
  opacity?: number;
}

/**
 * Positions the hand so its calibrated contact point sits exactly on (x, y).
 *
 * Everything else about the hand is fixed — no rotation, no squash — because
 * the illusion depends entirely on the tool tip tracking the stroke, and any
 * extra transform makes the anchor drift.
 */
export function Hand({ x, y, tool = "marker", family, opacity = 1 }: HandProps) {
  if (opacity <= 0.01) return null;

  const asset = getHand(tool, family);
  const height = BOARD.height * HAND_HEIGHT_RATIO;
  const width = (asset.width / asset.height) * height;

  // A plain <img>: next/image's loader and lazy behaviour would fight the
  // frame-accurate render Remotion needs, and the asset is already sized.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.src}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        width,
        height,
        left: x - asset.anchorRatio.x * width,
        top: y - asset.anchorRatio.y * height,
        opacity,
        pointerEvents: "none",
        // Grounds the hand on the board without a hard drop shadow.
        filter: "drop-shadow(0 18px 24px rgba(12, 18, 34, 0.18))",
      }}
    />
  );
}
