"use client";

/**
 * Renders one planned step: its parts, each at its own share of the step's
 * progress. All the geometry was decided by the planner — this file only
 * paints it — so the ink and the hand can never disagree.
 */

import { HAND_FONT, type BoardTheme } from "@/lib/engine/board";
import { headOf, partProgress } from "@/lib/engine/parts";
import type { PlacedStep } from "@/lib/engine/plan";
import type { MarkColor } from "@/types/storyboard";

import { DrawnPaths } from "./drawn-paths";
import { DrawnText } from "./drawn-text";

/** Board coordinates of the tool tip, or null when nothing is being drawn. */
export function elementHead(placed: PlacedStep, progress: number) {
  if (placed.element.type === "erase") {
    const { x, y, w, h } = placed.bounds;
    // The eraser sweeps side to side down the area it clears.
    const rows = 3;
    const row = Math.min(rows - 1, Math.floor(progress * rows));
    const along = (progress * rows) % 1;
    return {
      x: x + w * (row % 2 === 0 ? along : 1 - along),
      y: y + (h * (row + 0.5)) / rows,
    };
  }
  return headOf(placed.parts, placed.windows, progress);
}

export function DrawElementView({
  placed,
  progress,
  theme,
}: {
  placed: PlacedStep;
  progress: number;
  theme: BoardTheme;
}) {
  const { element } = placed;
  if (element.type === "erase") return null;

  const fallback: MarkColor | undefined =
    "color" in element ? (element.color ?? undefined) : undefined;
  const colorOf = (color?: MarkColor) => {
    const chosen = color ?? fallback;
    return chosen ? theme.colors[chosen] : theme.ink;
  };

  return (
    <>
      {placed.parts.map((part, index) => {
        const p = partProgress(placed.windows[index], progress);
        if (p <= 0) return null;

        if (part.kind === "text") {
          return (
            <DrawnText
              key={index}
              layout={part.layout}
              x={part.x}
              y={part.y}
              fontSize={part.fontSize}
              fontFamily={HAND_FONT}
              color={colorOf(part.color)}
              progress={p}
            />
          );
        }

        return (
          <div
            key={index}
            style={{ position: "absolute", left: part.frame.x, top: part.frame.y }}
          >
            <DrawnPaths
              paths={part.paths}
              progress={p}
              color={colorOf(part.color)}
              strokeWidth={part.strokeWidth}
              viewBox={`0 0 ${part.viewBox.w} ${part.viewBox.h}`}
              width={part.frame.w}
              height={part.frame.h}
            />
          </div>
        );
      })}
    </>
  );
}
