"use client";

/**
 * The whiteboard composition: a storyboard, drawn.
 *
 * One Remotion composition renders the whole video. At any frame it shows the
 * scene that owns that frame, every element drawn so far, the one being drawn
 * mid-stroke, and the hand sitting on the stroke's growing edge.
 */

import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Hand } from "@/components/engine/hand";
import {
  DrawElementView,
  elementHead,
} from "@/components/engine/elements/draw-element";
import { BOARD, BOARD_THEMES } from "@/lib/engine/board";
import { planScene, visibleSteps } from "@/lib/engine/plan";
import {
  activeStep,
  buildTimeline,
  sceneAtFrame,
  stepProgress,
} from "@/lib/engine/timeline";
import type { Storyboard } from "@/types/storyboard";
import type { VideoStyle } from "@/types";

export interface WhiteboardCompositionProps {
  storyboard: Storyboard;
  style: VideoStyle;
  /** Which hand family draws. */
  handFamily?: number;
}

/** Faint ruling under the content, per style. */
function BoardSurface({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
        backgroundSize: "56px 56px",
      }}
    />
  );
}

export function WhiteboardComposition({
  storyboard,
  style,
  handFamily,
}: WhiteboardCompositionProps) {
  const frame = useCurrentFrame();
  const theme = BOARD_THEMES[style];

  const timeline = useMemo(() => buildTimeline(storyboard), [storyboard]);
  const plans = useMemo(() => timeline.scenes.map(planScene), [timeline]);

  const scene = sceneAtFrame(frame, timeline);
  const plan = scene ? plans[timeline.scenes.indexOf(scene)] : null;

  if (!scene || !plan) {
    return <AbsoluteFill style={{ backgroundColor: theme.background }} />;
  }

  const drawn = visibleSteps(plan, frame);
  const current = activeStep(frame, scene);
  const placedCurrent = current
    ? (plan.steps.find((step) => step.timed === current) ?? null)
    : null;

  const head = placedCurrent
    ? elementHead(placedCurrent, stepProgress(frame, placedCurrent.timed))
    : null;

  // The eraser comes out only for an erase step.
  const tool = placedCurrent?.element.type === "erase" ? "eraser" : "marker";

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <BoardSurface color={theme.grid} />

      {drawn.map((placed) => (
        <DrawElementView
          key={`${scene.scene.id}-${placed.timed.index}`}
          placed={placed}
          progress={stepProgress(frame, placed.timed)}
          theme={theme}
        />
      ))}

      {head && (
        <Hand x={head.x} y={head.y} tool={tool} family={handFamily} opacity={1} />
      )}
    </AbsoluteFill>
  );
}

/** Total frames the storyboard needs — the Player has to be told up front. */
export function storyboardDurationInFrames(storyboard: Storyboard): number {
  return buildTimeline(storyboard).durationInFrames;
}

export const BOARD_DIMENSIONS = BOARD;
