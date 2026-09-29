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
 *
 * Two things are measured rather than reserved. A mark goes in the corner of
 * the picture it judges instead of across it, because a tick drawn through a
 * drawing reads as a correction of the drawing. And a label sits a fixed
 * distance under the ink — under the ink, not under the box the ink was given,
 * which is how captions ended up floating most of a slot below the thing they
 * name.
 */

import { ICON_PATHS, ICON_VIEWBOX } from "@/data/icon-paths";
import type { Box } from "@/lib/engine/board";
import { strokeBounds } from "@/lib/engine/ink-bounds";
import { centredLabel, fitted, labelUnder, textPart } from "@/lib/engine/labels";
import { clamp } from "@/lib/engine/motion";
import { boardStrokes, type Part, type StrokePart } from "@/lib/engine/parts";
import { orderPaths } from "@/lib/engine/path-sampling";
import {
  roughArrowhead,
  roughLine,
  roughPath,
  roughPolyline,
} from "@/lib/engine/rough";
import { CAP_HEIGHT, WRITING_LINE } from "@/lib/engine/text";
import type { MarkColor, SketchElement, SketchItem } from "@/types/storyboard";

/** Marker line width on the board, in pixels. */
const MARKER_WIDTH = 7;
const MIN_CONNECTOR = 78;
const MIN_SIDE = 60;

/**
 * Board pixels between a drawing's ink and the label naming it, and between the
 * whole sketch and its caption.
 *
 * Fixed, not proportional: the eye reads "this word belongs to that picture"
 * from an absolute gap, and a gap that grew with the drawing would break the
 * association exactly when the drawing is big enough to need it.
 */
const LABEL_GAP = 22;
const CAPTION_GAP = 28;

/** Type sizes these start at, before being fitted to the room available. */
const LABEL_SIZE = 38;
const CAPTION_SIZE = 36;

/**
 * A mark's size, as a fraction of the picture it judges, and how much of it
 * sits over the picture's corner rather than outside it.
 *
 * A badge. The marks used to be drawn across the whole picture: `check` ran
 * from 46% to 102% of its width and from 88% to 30% of its height, which is a
 * stroke straight through the middle of the drawing it is meant to approve.
 */
const BADGE_RATIO = 0.3;
const BADGE_MIN = 44;
const BADGE_OVERLAP = 0.3;

type Point = [number, number];

function iconPart(id: string, frame: Box, color?: MarkColor): StrokePart {
  const paths = orderPaths(ICON_PATHS[id] ?? []).flatMap((d) =>
    // The paths are on the 24-unit grid and end up `frame.w` wide, so the
    // wobble has to be asked for in board pixels rather than in grid units.
    roughPath(d, { unitScale: frame.w / ICON_VIEWBOX, bowing: 0.6, strokeWidth: 0.9 }),
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

/**
 * Where a mark goes: a badge on the top-right corner of the picture, sized to
 * the picture and mostly outside it, clamped so it never leaves the sketch's
 * own region and starts colliding with whatever is in the next slot.
 */
function badgeBox(piece: Box, frame: Box, limit: Box): Box {
  const size = Math.max(BADGE_MIN, Math.min(frame.w, frame.h) * BADGE_RATIO);
  return {
    x: clamp(
      piece.x + piece.w - size * BADGE_OVERLAP,
      limit.x,
      Math.max(limit.x, limit.x + limit.w - size),
    ),
    y: clamp(
      piece.y - size * (1 - BADGE_OVERLAP),
      limit.y,
      Math.max(limit.y, limit.y + limit.h - size),
    ),
    w: size,
    h: size,
  };
}

/**
 * What gets drawn over a picture once it is on the board.
 *
 * NOTE: all three marks are badges, `cross` included. A cross drawn across the
 * whole picture is arguably the better reading of "not this one" — it is how a
 * person crosses something out — but nothing in the storyboard says whether a
 * `cross` means "this is wrong" or "this is excluded", so the three are treated
 * alike rather than guessed at. If `cross` should go back over the picture, it
 * is the one `case` below.
 */
function markParts(item: SketchItem, frame: Box, ink: Box | null, limit: Box): Part[] {
  if (!item.mark) return [];

  const badge = badgeBox(ink ?? frame, frame, limit);
  const { x, y, w, h } = badge;

  switch (item.mark) {
    case "cross":
      return [
        boardStrokes(
          [
            ...roughLine(x, y, x + w, y + h, { bowing: 1 }),
            ...roughLine(x + w, y, x, y + h, { bowing: 1 }),
          ],
          7,
          "red",
        ),
      ];
    case "check":
      return [
        boardStrokes(
          roughPolyline(
            [
              [x + w * 0.08, y + h * 0.52],
              [x + w * 0.38, y + h * 0.86],
              [x + w * 0.95, y + h * 0.1],
            ],
            { bowing: 0.6 },
          ),
          8,
          "green",
        ),
      ];
    case "question": {
      // Sized so the glyph's cap height nearly fills the badge, then centred in
      // it — the type size alone says nothing about how much ink appears.
      const fontSize = (h * 0.92) / CAP_HEIGHT;
      const part = textPart("?", 0, 0, fontSize, w * 3, item.color ?? "brand");
      part.x = x + (w - part.layout.width) / 2;
      part.y = y + h / 2 + (fontSize * CAP_HEIGHT) / 2 - part.layout.lineHeight * WRITING_LINE;
      return [part];
    }
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

  const gap =
    relation === "none"
      ? Math.max(26, box.w * 0.04)
      : Math.max(MIN_CONNECTOR, box.w * 0.1);
  const cellWidth = (box.w - gap * (items.length - 1)) / items.length;

  /*
   * The text is laid out first, at its real size, because how much room it
   * needs is what is left over for the pictures. Reserving a guess and centring
   * the text inside it is what used to leave captions adrift: the slack went
   * between the drawing and the words instead of around the whole block.
   */
  const labels = items.map((item) =>
    item.label
      ? fitted(item.label, cellWidth, LABEL_SIZE * 1.3, Math.min(LABEL_SIZE * scale, cellWidth * 0.3))
      : null,
  );
  const labelHeight = labels.reduce((tallest, label) => Math.max(tallest, label?.layout.height ?? 0), 0);
  const labelBlock = labelHeight > 0 ? LABEL_GAP + labelHeight : 0;

  const caption = element.caption
    ? fitted(element.caption, box.w, CAPTION_SIZE * 2.6, CAPTION_SIZE * scale)
    : null;
  const captionBlock = caption ? CAPTION_GAP + caption.layout.height : 0;

  const side = Math.max(
    MIN_SIDE,
    Math.min(cellWidth * 0.94, box.h - labelBlock - captionBlock),
  );

  // The whole stack — pictures, labels, caption — centred in the space given.
  const top = box.y + Math.max(0, (box.h - (side + labelBlock + captionBlock)) / 2);
  const cellX = (index: number) => box.x + index * (cellWidth + gap);

  const parts: Part[] = [];
  const icons: { part: StrokePart; frame: Box }[] = [];

  items.forEach((item, index) => {
    const frame: Box = {
      x: cellX(index) + (cellWidth - side) / 2,
      y: top,
      w: side,
      h: side,
    };
    icons.push({ part: iconPart(item.icon, frame, item.color ?? element.color), frame });
  });

  /*
   * Where the drawings really end, as one line.
   *
   * Per piece would be wrong even though it is more precise: icons reach
   * different depths inside their 24-unit grid, so per-piece anchoring puts the
   * labels of a row at four different heights. A person writing under a row of
   * drawings writes along one line.
   */
  const inkBottom = icons.reduce((lowest, icon) => {
    const ink = strokeBounds(icon.part);
    return Math.max(lowest, ink ? ink.y + ink.h : icon.frame.y + icon.frame.h);
  }, -Infinity);
  const baseline = Number.isFinite(inkBottom) ? inkBottom : top + side;

  // The region a mark may not escape: the sketch's own box, with room above for
  // a badge that sits over the top corner of a picture flush with the top.
  const limit: Box = { x: box.x, y: Math.min(box.y, top - side * BADGE_RATIO), w: box.w, h: box.h };

  items.forEach((item, index) => {
    const { part: icon, frame } = icons[index];

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

    parts.push(icon);
    parts.push(...markParts(item, frame, strokeBounds(icon), limit));

    const label = labels[index];
    if (item.label && label) {
      parts.push(
        labelUnder(
          item.label,
          cellX(index) + cellWidth / 2,
          baseline + LABEL_GAP,
          cellWidth,
          label.layout.height,
          label.fontSize,
          item.color ?? element.color,
        ),
      );
    }
  });

  if (element.caption && caption) {
    // Under the ink of the whole thing, labels included.
    const under = labelHeight > 0 ? baseline + LABEL_GAP + labelHeight : baseline;
    parts.push(
      labelUnder(
        element.caption,
        box.x + box.w / 2,
        under + CAPTION_GAP,
        box.w,
        caption.layout.height,
        caption.fontSize,
        element.color,
      ),
    );
  }

  return parts;
}
