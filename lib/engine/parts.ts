/**
 * Every element on the board is a sequence of parts, drawn in order: strokes
 * (lines, curves, icons) and text (words written left to right).
 *
 * A diagram of supply and demand is: Y axis, X axis, axis names, demand curve,
 * its label, supply curve, its label — the order a teacher would draw it.
 *
 * This module is only the geometry. When each part is drawn, how long the
 * marker spends on it and where it goes in between belong to `pen.ts`, which
 * schedules all of it from these numbers. The hand and the ink therefore come
 * from one source and can never disagree.
 */

import type { Box } from "@/lib/engine/board";
import type { TextLayout } from "@/lib/engine/text";
import type { MarkColor } from "@/types/storyboard";

export interface StrokePart {
  kind: "strokes";
  paths: string[];
  /** Coordinate space the paths are written in. */
  viewBox: { w: number; h: number };
  /** Where that space lands on the board. */
  frame: Box;
  /** Line width, in viewBox units. */
  strokeWidth: number;
  color?: MarkColor;
}

export interface TextPart {
  kind: "text";
  text: string;
  layout: TextLayout;
  /** Top-left of the text block on the board. */
  x: number;
  y: number;
  fontSize: number;
  color?: MarkColor;
}

export type Part = StrokePart | TextPart;

/** Board-space strokes: paths already written in board pixels. */
export function boardStrokes(paths: string[], strokeWidth = 5, color?: MarkColor): StrokePart {
  return {
    kind: "strokes",
    paths,
    viewBox: { w: 1920, h: 1080 },
    frame: { x: 0, y: 0, w: 1920, h: 1080 },
    strokeWidth,
    color,
  };
}

/** How many progress values a part needs: one per path, or one per word. */
export function sliceCount(part: Part): number {
  return part.kind === "text" ? part.layout.words.length : part.paths.length;
}
