/**
 * Writing on a drawing.
 *
 * Diagrams and sketches both need short pieces of text placed against geometry
 * that was decided first, and both need them to shrink rather than overflow —
 * a label that spills out of its cell is worse than a small one.
 */

import { HAND_FONT } from "@/lib/engine/board";
import type { TextPart } from "@/lib/engine/parts";
import { layoutText } from "@/lib/engine/text";
import type { MarkColor } from "@/types/storyboard";

export function textPart(
  value: string,
  x: number,
  y: number,
  fontSize: number,
  maxWidth: number,
  color?: MarkColor,
): TextPart {
  const layout = layoutText(value, { fontSize, fontFamily: HAND_FONT, maxWidth });
  return { kind: "text", text: value, layout, x, y, fontSize, color };
}

/** The largest size, down to 18px, at which the label fits the space given. */
export function fitted(value: string, maxWidth: number, maxHeight: number, start: number) {
  let fontSize = start;
  let layout = layoutText(value, { fontSize, fontFamily: HAND_FONT, maxWidth });
  while ((layout.height > maxHeight || layout.width > maxWidth) && fontSize > 18) {
    fontSize = Math.max(18, fontSize * 0.9);
    layout = layoutText(value, { fontSize, fontFamily: HAND_FONT, maxWidth });
  }
  return { fontSize, layout };
}

/** A label centred on `cx`, inside a box `maxHeight` tall starting at `top`. */
export function centredLabel(
  value: string,
  cx: number,
  top: number,
  maxWidth: number,
  maxHeight: number,
  start: number,
  color?: MarkColor,
): TextPart {
  const { fontSize, layout } = fitted(value, maxWidth, maxHeight, start);
  return {
    kind: "text",
    text: value,
    layout,
    x: cx - layout.width / 2,
    y: top + Math.max(0, maxHeight - layout.height) / 2,
    fontSize,
    color,
  };
}
