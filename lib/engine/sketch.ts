/**
 * A sketch: several drawings that mean something together.
 *
 * One icon can only decorate a sentence. Two icons with an arrow between them
 * are an explanation, and that is the whole point of drawing on a board instead
 * of writing on it — you would not explain rain to a child with three bullets,
 * you would draw a cloud, an arrow and a puddle.
 *
 * The pieces are laid out in a row and drawn the way a person draws them: the
 * first picture, whatever is struck through or ticked on it, its label, then the
 * connector, then the next picture. The hand therefore works left to right and
 * never doubles back.
 */

import { ICON_PATHS, ICON_VIEWBOX } from "@/data/icon-paths";
import type { Box } from "@/lib/engine/board";
import { centredLabel, textPart } from "@/lib/engine/labels";
import { boardStrokes, type Part, type StrokePart } from "@/lib/engine/parts";
import { orderPaths } from "@/lib/engine/path-sampling";
import {
  roughArrowhead,
  roughLine,
  roughPath,
  roughPolyline,
} from "@/lib/engine/rough";
import type { MarkColor, SketchElement, SketchItem } from "@/types/storyboard";

/** Marker line width on the board, in pixels. */
const MARKER_WIDTH = 7;
const MIN_CONNECTOR = 78;
const LABEL_GAP = 16;

type Point = [number, number];

function iconPart(id: string, frame: Box, color?: MarkColor): StrokePart {
  const paths = orderPaths(ICON_PATHS[id] ?? []).flatMap((d) =>
    roughPath(d, { roughness: 0.5, bowing: 0.6, strokeWidth: 0.9 }),
  );
  return {
    kind: "strokes",
    paths,
    viewBox: { w: ICON_VIEWBOX, h: ICON_VIEWBOX },
    frame,
    // A marker has one thickness whatever it draws: ~7px on the board,
    // expressed in icon units so a big drawing does not turn into a blob.
    strokeWidth: (MARKER_WIDTH * ICON_VIEWBOX) / Math.max(frame.w, 1),
    color,
  };
}

/** What gets drawn over a picture once it is on the board. */
function markParts(item: SketchItem, frame: Box): Part[] {
  const inset = frame.w * 0.12;
  const left = frame.x + inset;
  const right = frame.x + frame.w - inset;
  const top = frame.y + inset;
  const bottom = frame.y + frame.h - inset;

  switch (item.mark) {
    case "cross":
      return [
        boardStrokes(
          [
            ...roughLine(left, top, right, bottom, { bowing: 1.4 }),
            ...roughLine(right, top, left, bottom, { bowing: 1.4 }),
          ],
          8,
          "red",
        ),
      ];
    case "check":
      return [
        boardStrokes(
          roughPolyline(
            [
              [frame.x + frame.w * 0.46, frame.y + frame.h * 0.66],
              [frame.x + frame.w * 0.62, frame.y + frame.h * 0.88],
              [frame.x + frame.w * 1.02, frame.y + frame.h * 0.3],
            ],
            { bowing: 0.8 },
          ),
          9,
          "green",
        ),
      ];
    case "question":
      return [
        textPart(
          "?",
          frame.x + frame.w * 0.9,
          frame.y - frame.h * 0.12,
          frame.h * 0.42,
          frame.w,
          item.color ?? "brand",
        ),
      ];
    default:
      return [];
  }
}

/** What gets drawn in the gap between two pictures. */
function connectorParts(
  relation: SketchElement["relation"],
  from: number,
  to: number,
  y: number,
  size: number,
): Part[] {
  const mid = (from + to) / 2;
  const arm = Math.min(size * 0.22, (to - from) * 0.3);

  switch (relation) {
    case "arrow": {
      const start: Point = [from, y];
      const tip: Point = [to, y];
      return [
        boardStrokes(
          [...roughPolyline([start, tip]), ...roughArrowhead(tip, start, size * 0.16)],
          6,
        ),
      ];
    }
    case "plus":
      return [
        boardStrokes(
          [
            ...roughLine(mid - arm, y, mid + arm, y, { bowing: 0.4 }),
            ...roughLine(mid, y - arm, mid, y + arm, { bowing: 0.4 }),
          ],
          6,
        ),
      ];
    case "equals":
      return [
        boardStrokes(
          [
            ...roughLine(mid - arm, y - arm * 0.45, mid + arm, y - arm * 0.45, { bowing: 0.5 }),
            ...roughLine(mid - arm, y + arm * 0.45, mid + arm, y + arm * 0.45, { bowing: 0.5 }),
          ],
          6,
        ),
      ];
    case "vs":
      return [centredLabel("vs", mid, y - size * 0.16, to - from, size * 0.32, size * 0.26)];
    default:
      return [];
  }
}

export function sketchParts(element: SketchElement, box: Box, scale: number): Part[] {
  const items = element.items.slice(0, 4);
  if (items.length === 0) return [];

  const relation = element.relation ?? "none";
  const labelled = items.some((item) => item.label);

  // The caption sits under everything and takes its height off the top of the
  // space the pictures get.
  const captionSize = Math.max(24, 34 * scale);
  const captionHeight = element.caption ? captionSize * 1.45 : 0;
  const bodyHeight = box.h - captionHeight;

  const gap =
    relation === "none"
      ? Math.max(26, box.w * 0.04)
      : Math.max(MIN_CONNECTOR, box.w * 0.1);
  const cellWidth = (box.w - gap * (items.length - 1)) / items.length;

  const labelSize = Math.max(22, Math.min(36 * scale, cellWidth * 0.26));
  const labelHeight = labelled ? labelSize * 2.6 + LABEL_GAP : 0;
  const side = Math.max(
    60,
    Math.min(cellWidth * 0.94, bodyHeight - labelHeight),
  );

  const top = box.y + Math.max(0, (bodyHeight - labelHeight - side) / 2);
  const cellX = (index: number) => box.x + index * (cellWidth + gap);

  const parts: Part[] = [];

  items.forEach((item, index) => {
    const frame: Box = {
      x: cellX(index) + (cellWidth - side) / 2,
      y: top,
      w: side,
      h: side,
    };

    if (index > 0 && relation !== "none") {
      parts.push(
        ...connectorParts(
          relation,
          cellX(index - 1) + cellWidth + gap * 0.16,
          cellX(index) - gap * 0.16,
          top + side / 2,
          side,
        ),
      );
    }

    parts.push(iconPart(item.icon, frame, item.color ?? element.color));
    parts.push(...markParts(item, frame));

    if (item.label) {
      parts.push(
        centredLabel(
          item.label,
          cellX(index) + cellWidth / 2,
          top + side + LABEL_GAP,
          cellWidth,
          labelHeight - LABEL_GAP,
          labelSize,
          item.color ?? element.color,
        ),
      );
    }
  });

  if (element.caption) {
    parts.push(
      centredLabel(
        element.caption,
        box.x + box.w / 2,
        box.y + box.h - captionHeight,
        box.w,
        captionHeight,
        captionSize,
        element.color,
      ),
    );
  }

  return parts;
}
