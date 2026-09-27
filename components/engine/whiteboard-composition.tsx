"use client";

/**
 * The whiteboard composition: a storyboard, drawn.
 *
 * At any frame it shows the scene that owns the frame, everything drawn so
 * far, the step in progress, and the hand. Between steps the hand behaves like
 * a person's: over a short pause it glides, lifted, to where the next stroke
 * starts; over a long one it lingers, then leaves and comes back in time.
 */

import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Hand } from "@/components/engine/hand";
import {
  DrawElementView,
  elementHead,
} from "@/components/engine/elements/draw-element";
import { BOARD, BOARD_THEMES } from "@/lib/engine/board";
import { planScene, visibleSteps, type PlacedStep, type ScenePlan } from "@/lib/engine/plan";
import { clearTextCache } from "@/lib/engine/text";
import {
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

const GLIDE_MAX = BOARD.fps * 1.6;
const LINGER = BOARD.fps * 0.5;
const FADE = BOARD.fps * 0.25;

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

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const endOf = (step: PlacedStep) => step.timed.from + step.timed.durationInFrames;

interface HandState {
  x: number;
  y: number;
  opacity: number;
  tool: "marker" | "eraser";
}

function handAt(frame: number, plan: ScenePlan): HandState | null {
  const steps = plan.steps.filter((step) => step.parts.length || step.element.type === "erase");
  const tool = (step: PlacedStep) => (step.element.type === "erase" ? "eraser" : "marker");

  const active = steps.find((step) => frame >= step.timed.from && frame < endOf(step));
  if (active) {
    const head = elementHead(active, stepProgress(frame, active.timed));
    return head ? { ...head, opacity: 1, tool: tool(active) } : null;
  }

  const previous = [...steps].reverse().find((step) => endOf(step) <= frame);
  const next = steps.find((step) => step.timed.from > frame);
  const from = previous ? elementHead(previous, 1) : null;
  const to = next ? elementHead(next, 0) : null;

  // Short pause: glide to the next stroke, lifted slightly off the board.
  if (previous && next && from && to && next.timed.from - endOf(previous) <= GLIDE_MAX) {
    const t = ease((frame - endOf(previous)) / (next.timed.from - endOf(previous)));
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * 14,
      opacity: 1,
      tool: tool(next),
    };
  }

  // Long pause: stay a moment after finishing, then fade out…
  if (previous && from) {
    const since = frame - endOf(previous);
    if (since < LINGER + FADE) {
      return {
        ...from,
        opacity: since < LINGER ? 1 : 1 - (since - LINGER) / FADE,
        tool: tool(previous),
      };
    }
  }
  // …and fade back in just before the next stroke.
  if (next && to) {
    const until = next.timed.from - frame;
    if (until < FADE) return { ...to, opacity: 1 - until / FADE, tool: tool(next) };
  }
  return null;
}

export function WhiteboardComposition({
  storyboard,
  style,
  handFamily,
}: WhiteboardCompositionProps) {
  const frame = useCurrentFrame();
  const theme = BOARD_THEMES[style];

  // Text is measured with canvas, which only knows the handwriting face once
  // it has loaded. Re-plan when it has, discarding fallback-font measurements.
  // TODO(render): server-side rendering must hold the frame with Remotion's
  // delayRender() until `document.fonts.ready`, for the same reason.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      clearTextCache();
      setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const timeline = useMemo(() => buildTimeline(storyboard), [storyboard]);
  const plans = useMemo(
    () => timeline.scenes.map(planScene),
    // fontsReady is a dependency on purpose: it invalidates the measurements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, fontsReady],
  );

  const scene = sceneAtFrame(frame, timeline);
  const plan = scene ? plans[timeline.scenes.indexOf(scene)] : null;

  if (!scene || !plan) {
    return <AbsoluteFill style={{ backgroundColor: theme.background }} />;
  }

  const hand = handAt(frame, plan);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <BoardSurface color={theme.grid} />

      {visibleSteps(plan, frame).map((placed) => (
        <DrawElementView
          key={`${scene.scene.id}-${placed.timed.index}`}
          placed={placed}
          progress={stepProgress(frame, placed.timed)}
          theme={theme}
        />
      ))}

      {hand && (
        <Hand x={hand.x} y={hand.y} tool={hand.tool} family={handFamily} opacity={hand.opacity} />
      )}
    </AbsoluteFill>
  );
}

/** Total frames the storyboard needs — the Player has to be told up front. */
export function storyboardDurationInFrames(storyboard: Storyboard): number {
  return buildTimeline(storyboard).durationInFrames;
}

export const BOARD_DIMENSIONS = BOARD;
