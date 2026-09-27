"use client";

/**
 * The whiteboard composition: a storyboard, drawn.
 *
 * At any frame it shows the scene that owns the frame, everything drawn so far,
 * the step in progress, and the hand — through a camera that leans toward
 * whatever is being drawn.
 *
 * Almost nothing is decided here. The planner owns the geometry, the pen
 * schedule owns the timing, `hand-motion` owns where the hand is and the camera
 * owns the frame; this file asks each of them once and paints the answer.
 */

import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame } from "remotion";

import { Hand } from "@/components/engine/hand";
import { DrawElementView } from "@/components/engine/elements/draw-element";
import { BOARD, BOARD_THEMES } from "@/lib/engine/board";
import { cameraAt } from "@/lib/engine/camera";
import { endFrameOf, stageAt, type StageState } from "@/lib/engine/hand-motion";
import { penProgress, penStateAt } from "@/lib/engine/pen";
import { planStoryboard, visibleSteps, type PlacedStep, type ScenePlan } from "@/lib/engine/plan";
import { clearTextCache } from "@/lib/engine/text";
import { buildTimeline, sceneAtFrame } from "@/lib/engine/timeline";
import type { Storyboard } from "@/types/storyboard";
import type { VideoStyle } from "@/types";

export interface WhiteboardCompositionProps {
  storyboard: Storyboard;
  style: VideoStyle;
  /** Which hand family draws. */
  handFamily?: number;
  /**
   * Where to fetch each scene's voice-over, by scene id.
   *
   * The drawing is already synchronised to it — every step carries the second
   * its phrase is spoken — so all this has to do is play the file over the
   * frames the scene occupies. A scene with no entry plays silent.
   */
  audioUrls?: Record<string, string>;
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

/**
 * How much of a visible step is inked.
 *
 * `undefined` means finished, which is the common case and costs nothing. A
 * step still drawing gets its own share — normally the active one, whose state
 * the stage already worked out, but a crowded scene can start a step while the
 * previous one is finishing, and drawing that one complete from its first frame
 * would pop the whole thing onto the board at once.
 */
function slicesFor(placed: PlacedStep, stage: StageState, frame: number) {
  if (frame >= endFrameOf(placed, BOARD.fps)) return undefined;
  if (placed === stage.active) return stage.pen?.slices ?? undefined;
  return penStateAt(
    placed.pen,
    penProgress(frame, placed.timed, placed.pen, BOARD.fps),
  ).slices;
}

export function WhiteboardComposition({
  storyboard,
  style,
  handFamily,
  audioUrls,
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

  const { timeline, plans } = useMemo(
    () => planStoryboard(storyboard),
    // fontsReady is a dependency on purpose: it invalidates the measurements,
    // and with them every stroke length the pacing was worked out from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storyboard, fontsReady],
  );

  const scene = sceneAtFrame(frame, timeline);
  const plan: ScenePlan | null = scene ? plans[timeline.scenes.indexOf(scene)] : null;

  if (!scene || !plan) {
    return <AbsoluteFill style={{ backgroundColor: theme.background }} />;
  }

  const stage = stageAt(frame, plan, BOARD.fps);
  const camera = cameraAt(plan.camera, frame, BOARD.fps);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      {/* Outside the camera transform: sound has no position on the board. */}
      {timeline.scenes.map((timed) => {
        const src = audioUrls?.[timed.scene.id];
        if (!src) return null;
        return (
          <Sequence
            key={`voz-${timed.scene.id}`}
            from={timed.from}
            durationInFrames={timed.durationInFrames}
          >
            {/*
              Without this the Player keeps advancing frames while the audio
              stalls. Remotion tolerates 0.65s of drift and then seeks the audio
              back into place, which replays the second before — you hear the
              last word of the sentence twice. Holding the clock until the audio
              is ready costs a beat and removes the stutter entirely.
            */}
            <Audio src={src} pauseWhenBuffering />
          </Sequence>
        );
      })}

      <AbsoluteFill
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <BoardSurface color={theme.grid} />

        {visibleSteps(plan, frame).map((placed) => (
          <DrawElementView
            key={`${scene.scene.id}-${placed.timed.index}`}
            placed={placed}
            slices={slicesFor(placed, stage, frame)}
            theme={theme}
          />
        ))}

        {stage.hand && (
          <Hand
            x={stage.hand.x}
            y={stage.hand.y}
            angle={stage.hand.angle}
            lift={stage.hand.lift}
            speed={stage.hand.speed}
            frame={frame}
            tool={stage.hand.tool}
            family={handFamily}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Total frames the storyboard needs — the Player has to be told up front. */
export function storyboardDurationInFrames(storyboard: Storyboard): number {
  return buildTimeline(storyboard).durationInFrames;
}

export const BOARD_DIMENSIONS = BOARD;
