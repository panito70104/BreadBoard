"use client";

/**
 * Renders one planned step.
 *
 * All the geometry was decided by the planner and all the timing by the pen
 * schedule — this file only paints what they worked out, so the ink and the
 * hand can never disagree. A step with no `slices` is one that finished drawing
 * some time ago: everything it owns is simply complete.
 */

import { HAND_FONT, type BoardTheme } from "@/lib/engine/board";
import type { PlacedStep } from "@/lib/engine/plan";
import type { MarkColor } from "@/types/storyboard";

import { DrawnPaths } from "./drawn-paths";
import { DrawnText } from "./drawn-text";

export function DrawElementView({
  placed,
  slices,
  theme,
}: {
  placed: PlacedStep;
  /** Per part, how much of each path or word is inked. Omit when fully drawn. */
  slices?: number[][];
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
        const share = slices?.[index];
        // No share array at all means the step is behind us and fully inked.
        if (share && share.every((value) => value <= 0)) return null;

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
              wordProgress={share ?? part.layout.words.map(() => 1)}
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
              shares={share ?? part.paths.map(() => 1)}
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
