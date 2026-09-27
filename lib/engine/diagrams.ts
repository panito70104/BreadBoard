/**
 * Diagrams, built from nothing but their labels.
 *
 * The model only says `{ kind: "axes", labels: [...] }`; everything else —
 * curves, boxes, bars, rules, and where each label is written — is decided here,
 * as a sequence of parts in the order a person would draw them.
 */

import { HAND_FONT, type Box } from "@/lib/engine/board";
import { centredLabel, textPart } from "@/lib/engine/labels";
import { boardStrokes, type Part } from "@/lib/engine/parts";
import {
  roughArrowhead,
  roughLine,
  roughPolyline,
  roughQuadratic,
  roughRect,
} from "@/lib/engine/rough";
import { layoutText } from "@/lib/engine/text";
import type { DiagramElement, MarkColor } from "@/types/storyboard";

/** Series colours, in order. Demand is blue and supply green by convention. */
const SERIES_COLORS: MarkColor[] = ["blue", "green", "red", "amber", "brand"];

type Point = [number, number];

function axes(labels: string[], box: Box, scale: number): Part[] {
  const [yName = "", xName = "", ...series] = labels;
  const fontSize = Math.max(24, 34 * scale);
  const ox = box.x + 18;
  const top = box.y + fontSize * 1.5;
  const oy = box.y + box.h - fontSize * 1.7;
  const right = box.x + box.w - 12;

  const parts: Part[] = [
    boardStrokes([
      ...roughPolyline([[ox, oy], [ox, top]]),
      ...roughArrowhead([ox, top], [ox, oy], 18),
    ]),
    boardStrokes([
      ...roughPolyline([[ox, oy], [right, oy]]),
      ...roughArrowhead([right, oy], [ox, oy], 18),
    ]),
  ];
  if (yName) parts.push(textPart(yName, ox - 6, box.y, fontSize, box.w * 0.6));
  if (xName) {
    const label = textPart(xName, 0, oy + 8, fontSize, box.w * 0.6);
    label.x = right - label.layout.width;
    parts.push(label);
  }

  // Curves end where the longest series label still fits to their right, so
  // no label has to be pushed back over its own curve.
  const widest = series.reduce(
    (max, name) =>
      Math.max(max, layoutText(name, { fontSize, fontFamily: HAND_FONT, maxWidth: box.w }).width),
    0,
  );
  const x0 = ox + (right - ox) * 0.1;
  const x1 = Math.max(ox + (right - ox) * 0.55, box.x + box.w - widest - 18);
  const y0 = top + (oy - top) * 0.12;
  const y1 = oy - (oy - top) * 0.12;
  const dx = x1 - x0;
  const dy = y1 - y0;

  series.forEach((name, index) => {
    // One series rises; with several they alternate so the first two cross.
    const falling = series.length > 1 && index % 2 === 0;
    const from: Point = falling ? [x0, y0] : [x0, y1];
    const to: Point = falling ? [x1, y1] : [x1, y0];
    const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    // Falling curves bow toward the origin, rising ones away from the Y axis.
    const control: Point = falling
      ? [mid[0] - dx * 0.16, mid[1] + dy * 0.16]
      : [mid[0] + dx * 0.1, mid[1] + dy * 0.1];
    const color = SERIES_COLORS[index % SERIES_COLORS.length];

    parts.push(boardStrokes(roughQuadratic(from, control, to, { bowing: 0.6 }), 6, color));
    const label = textPart(name, to[0] + 10, 0, fontSize, box.x + box.w - to[0] + 40, color);
    label.y = falling ? to[1] - label.layout.height * 0.9 : to[1] - label.layout.height * 0.4;
    // Not enough room on the right: write it to the left of the curve's end.
    if (label.x + label.layout.width > box.x + box.w + 30) {
      label.x = to[0] - label.layout.width - 12;
    }
    parts.push(label);
  });

  return parts;
}

/**
 * Bars. The most honest picture of "this one is bigger than that one", and the
 * one a child reads without being taught how.
 *
 * Without numbers the bars are stepped evenly: the drawing still says which is
 * larger, which is usually the whole point, without inventing quantities.
 */
function bars(labels: string[], values: number[] | undefined, box: Box, scale: number): Part[] {
  const fontSize = Math.max(22, 32 * scale);
  const ox = box.x + 20;
  const right = box.x + box.w - 12;
  const oy = box.y + box.h - fontSize * 2.1;
  const top = box.y + 14;

  const heights = labels.map((_, index) =>
    values?.[index] !== undefined && Number.isFinite(values[index]) && values[index] > 0
      ? values[index]
      : index + 1,
  );
  const tallest = Math.max(...heights, 1);

  const parts: Part[] = [
    boardStrokes(roughPolyline([[ox, top], [ox, oy], [right, oy]], { bowing: 0.8 })),
  ];

  const slot = (right - ox) / labels.length;
  const width = slot * 0.56;

  labels.forEach((label, index) => {
    const height = Math.max(26, ((oy - top) * 0.92 * heights[index]) / tallest);
    const x = ox + slot * index + (slot - width) / 2;
    const color = SERIES_COLORS[index % SERIES_COLORS.length];

    parts.push(boardStrokes(roughRect(x, oy - height, width, height), 5, color));
    parts.push(
      centredLabel(label, x + width / 2, oy + 10, slot - 8, fontSize * 2, fontSize),
    );
  });

  return parts;
}

/**
 * A table, drawn the way one gets drawn: the headings first, the rule under
 * them, the dividers, and then the cells filled in row by row.
 */
function table(labels: string[], columns: number, box: Box, scale: number): Part[] {
  const cols = Math.max(2, Math.min(4, Math.round(columns) || 2));
  const rows = Math.max(1, Math.ceil(labels.length / cols));
  const cellW = box.w / cols;
  const cellH = Math.min(box.h / rows, Math.max(74, box.h * 0.32));
  const height = cellH * rows;
  const fontSize = Math.max(22, 34 * scale);

  const cellX = (col: number) => box.x + col * cellW;
  const rowY = (row: number) => box.y + row * cellH;
  const at = (row: number, col: number) => labels[row * cols + col];

  const parts: Part[] = [];

  // The headings, then the rule that makes them headings.
  for (let col = 0; col < cols; col += 1) {
    const heading = at(0, col);
    if (heading) {
      parts.push(
        centredLabel(heading, cellX(col) + cellW / 2, rowY(0), cellW - 22, cellH, fontSize),
      );
    }
  }
  parts.push(
    boardStrokes(
      roughLine(box.x, rowY(1), box.x + box.w, rowY(1), { bowing: 1.6 }),
      6,
    ),
  );

  for (let col = 1; col < cols; col += 1) {
    parts.push(
      boardStrokes(
        roughLine(cellX(col), box.y + 6, cellX(col), box.y + height, { bowing: 1.4 }),
        5,
      ),
    );
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = at(row, col);
      if (!value) continue;
      parts.push(
        centredLabel(
          value,
          cellX(col) + cellW / 2,
          rowY(row),
          cellW - 22,
          cellH,
          fontSize * 0.92,
        ),
      );
    }
  }

  return parts;
}

function timeline(labels: string[], box: Box, scale: number): Part[] {
  const y = box.y + box.h * 0.38;
  const parts: Part[] = [
    boardStrokes([
      ...roughPolyline([[box.x, y], [box.x + box.w, y]]),
      ...roughArrowhead([box.x + box.w, y], [box.x, y], 22),
    ]),
  ];
  const step = box.w / labels.length;
  labels.forEach((label, index) => {
    const cx = box.x + step * (index + 0.5);
    parts.push(boardStrokes(roughLine(cx, y - 20, cx, y + 20, { bowing: 0.3 })));
    parts.push(centredLabel(label, cx, y + 30, step - 16, box.h - (y - box.y) - 40, 36 * scale));
  });
  return parts;
}

function boxes(
  kind: "flow" | "compare" | "cycle",
  labels: string[],
  box: Box,
  scale: number,
): Part[] {
  const count = labels.length;
  const connected = kind !== "compare";
  const gap = (connected ? 60 : 30) * Math.max(scale, 0.6);
  const cellW = (box.w - gap * (count - 1)) / count;
  const cellH = Math.min(box.h * 0.55, Math.max(90, cellW * 0.72));
  const top = kind === "cycle" ? box.y + (box.h - cellH) * 0.3 : box.y + (box.h - cellH) / 2;
  const cellX = (index: number) => box.x + index * (cellW + gap);

  const parts: Part[] = [];
  labels.forEach((label, index) => {
    const x = cellX(index);
    if (connected && index > 0) {
      const from: Point = [cellX(index - 1) + cellW + 8, top + cellH / 2];
      const tip: Point = [x - 8, top + cellH / 2];
      parts.push(boardStrokes([...roughPolyline([from, tip]), ...roughArrowhead(tip, from, 18)]));
    }
    parts.push(boardStrokes(roughRect(x, top, cellW, cellH)));
    parts.push(centredLabel(label, x + cellW / 2, top + 8, cellW - 20, cellH - 16, 36 * scale));
  });

  if (kind === "cycle" && count > 1) {
    const from: Point = [cellX(count - 1) + cellW / 2, top + cellH + 8];
    const tip: Point = [cellX(0) + cellW / 2, top + cellH + 8];
    const control: Point = [(from[0] + tip[0]) / 2, Math.min(box.y + box.h, top + cellH + box.h * 0.4)];
    parts.push(
      boardStrokes([
        ...roughQuadratic(from, control, tip, { bowing: 0.5 }),
        ...roughArrowhead(tip, [tip[0] + 20, tip[1] + 30], 18),
      ]),
    );
  }
  return parts;
}

function tree(labels: string[], box: Box, scale: number): Part[] {
  const [root = "", ...children] = labels;
  const rootW = Math.min(box.w * 0.46, 420);
  const rootH = Math.min(box.h * 0.26, 120);
  const rootX = box.x + (box.w - rootW) / 2;
  const parts: Part[] = [
    boardStrokes(roughRect(rootX, box.y, rootW, rootH)),
    centredLabel(root, rootX + rootW / 2, box.y + 8, rootW - 20, rootH - 16, 38 * scale),
  ];
  if (children.length === 0) return parts;

  const gap = 26;
  const cellW = (box.w - gap * (children.length - 1)) / children.length;
  const cellH = Math.min(box.h * 0.3, 130);
  const top = box.y + box.h - cellH;
  children.forEach((label, index) => {
    const x = box.x + index * (cellW + gap);
    parts.push(boardStrokes(roughLine(rootX + rootW / 2, box.y + rootH + 6, x + cellW / 2, top - 6)));
    parts.push(boardStrokes(roughRect(x, top, cellW, cellH)));
    parts.push(centredLabel(label, x + cellW / 2, top + 8, cellW - 20, cellH - 16, 34 * scale));
  });
  return parts;
}

export function diagramParts(element: DiagramElement, box: Box, scale: number): Part[] {
  switch (element.kind) {
    case "axes":
      return axes(element.labels, box, scale);
    case "bars":
      return bars(element.labels, element.values, box, scale);
    case "table":
      return table(element.labels, element.columns ?? 2, box, scale);
    case "timeline":
      return timeline(element.labels, box, scale);
    case "tree":
      return tree(element.labels, box, scale);
    case "flow":
    case "compare":
    case "cycle":
      return boxes(element.kind, element.labels, box, scale);
  }
}
