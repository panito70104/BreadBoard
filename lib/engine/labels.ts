/**
 * Writing on a drawing.
 *
 * Diagrams and sketches both need short pieces of text placed against geometry
 * that was decided first, and both need them to shrink rather than overflow —
 * a label that spills out of its cell is worse than a small one. But only down
 * to a point: below `MIN_TEXT_SIZE` a label has stopped being small and started
 * being unreadable, and an unreadable label is worse than either.
 */

import { HAND_FONT } from "@/lib/engine/board";
import type { TextPart } from "@/lib/engine/parts";
import { CAP_HEIGHT, X_HEIGHT, layoutText } from "@/lib/engine/text";
import type { MarkColor } from "@/types/storyboard";

/**
 * The smallest type the board will draw, in board pixels.
 *
 * Measured on Caveat: the x-height is 0.357 of the type size and the cap height
 * 0.701, at every size. The old floor of 18px is therefore a 6.4px x-height —
 * 0.6% of the board's height, which is mush the moment the video is watched on
 * a phone. At 30px the cap height is 21px, about 2% of the board, which is the
 * usual floor for secondary text meant to be read on a small screen.
 *
 * (A 30px *x-height* would need an 84px body, which is the size of the scene
 * title. Labels are not titles.)
 */
export const MIN_TEXT_SIZE = 30;

/** What `MIN_TEXT_SIZE` buys, for anything that wants to check. */
export const MIN_X_HEIGHT = MIN_TEXT_SIZE * X_HEIGHT;
export const MIN_CAP_HEIGHT = MIN_TEXT_SIZE * CAP_HEIGHT;

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

/** The largest size, down to `floor`, at which the label fits the space given. */
export function fitted(
  value: string,
  maxWidth: number,
  maxHeight: number,
  start: number,
  floor = MIN_TEXT_SIZE,
) {
  let fontSize = Math.max(floor, start);
  let layout = layoutText(value, { fontSize, fontFamily: HAND_FONT, maxWidth });
  while ((layout.height > maxHeight || layout.width > maxWidth) && fontSize > floor) {
    fontSize = Math.max(floor, fontSize * 0.9);
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

/**
 * A label centred on `cx` whose top edge sits exactly at `top`.
 *
 * The difference from `centredLabel` is the whole of task 2: centring inside a
 * reserved box leaves half the slack between the drawing and its label, so a
 * caption reserved two lines of room floats most of a line below the thing it
 * names. A label belongs a fixed distance under the ink, and nothing else.
 */
export function labelUnder(
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
    y: top,
    fontSize,
    color,
  };
}
