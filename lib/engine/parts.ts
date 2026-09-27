/**
 * Every element on the board is a sequence of parts, drawn in order: strokes
 * (lines, curves, icons) and text (words written left to right).
 *
 * A diagram of supply and demand is: Y axis, X axis, axis names, demand curve,
 * its label, supply curve, its label — the order a teacher would draw it.
 * The hand always follows the part in progress, so it can never retrace or
 * wander: its position and the ink come from the same numbers.
 */

import type { Box } from "@/lib/engine/board";
import { pathLengths, penPoint } from "@/lib/engine/path-sampling";
import { writingHead, type TextLayout } from "@/lib/engine/text";
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

/** Rough drawing time of a part, used to share a step's duration fairly. */
function partSeconds(part: Part): number {
  if (part.kind === "text") return Math.max(0.3, part.text.length * 0.05);
  const scale = part.frame.w / part.viewBox.w;
  const length = pathLengths(part.paths).reduce((sum, value) => sum + value, 0) * scale;
  return Math.max(0.15, length / 1100);
}

export type PartWindow = readonly [start: number, end: number];

/** The slice of the step's 0–1 progress each part owns. */
export function partWindows(parts: Part[]): PartWindow[] {
  const seconds = parts.map(partSeconds);
  const total = seconds.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  return seconds.map((value) => {
    const start = cursor;
    cursor += value / total;
    return [start, Math.min(1, cursor)] as const;
  });
}

export function partProgress(window: PartWindow, progress: number): number {
  const [start, end] = window;
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start || 1);
}

function partHead(part: Part, progress: number): { x: number; y: number } | null {
  if (part.kind === "text") {
    const head = writingHead(part.layout, progress);
    return { x: part.x + head.x, y: part.y + head.y };
  }
  const point = penPoint(part.paths, progress);
  if (!point) return null;
  return {
    x: part.frame.x + (point.x * part.frame.w) / part.viewBox.w,
    y: part.frame.y + (point.y * part.frame.h) / part.viewBox.h,
  };
}

/** Where the marker tip is, `progress` of the way through the parts. */
export function headOf(
  parts: Part[],
  windows: PartWindow[],
  progress: number,
): { x: number; y: number } | null {
  if (parts.length === 0) return null;
  const index = windows.findIndex(([, end]) => progress < end);
  const at = index === -1 ? parts.length - 1 : index;
  return partHead(parts[at], partProgress(windows[at], progress));
}
