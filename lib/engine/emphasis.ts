/**
 * Emphasis: the shape drawn around something already on the board.
 *
 * It used to be sized to the slot. A slot is a region the planner hands out to
 * lay content in, not the content — a sketch centred in a tall slot leaves
 * hundreds of empty pixels above and below it — so a circle "around" a drawing
 * was an ellipse around the empty space the drawing sits in. It swallowed the
 * title, enclosed labels belonging to nothing, claimed half the board, and the
 * camera cut it in half because the step reported its *target* as its bounds
 * instead of the shape it had actually drawn.
 *
 * So everything here is measured against real ink (`ink-bounds.ts`), and the
 * shape that comes out is checked against the board it has to live on before
 * it is accepted:
 *
 * 1. it is drawn, with padding proportional to what it is wrapping;
 * 2. the strokes Rough.js really produced are measured — not the ideal shape,
 *    because the wobble on a 470px radius is worth tens of pixels;
 * 3. if it leaves the board, or crosses ink it does not belong to, or claims
 *    an absurd share of the board, the padding is tightened and it is tried
 *    again, and then the shape is downgraded to a more contained one.
 *
 * The ladder is circle → box → underline → nothing at all. Dropping it is the
 * last resort and it is recorded, never thrown: a video with one missing
 * underline is worth immeasurably more than no video.
 */

import type { Box } from "@/lib/engine/board";
import { BOARD } from "@/lib/engine/board";
import { boxArea, partsBounds } from "@/lib/engine/ink-bounds";
import { boardStrokes, type Part } from "@/lib/engine/parts";
import { samplePath } from "@/lib/engine/path-sampling";
import {
  roughEllipse,
  roughLine,
  roughQuadratic,
  roughRect,
} from "@/lib/engine/rough";
import type { EmphasisShape, MarkColor } from "@/types/storyboard";

/* -------------------------------------------------------------------------- */
/*                                 Constants                                  */
/* -------------------------------------------------------------------------- */

/**
 * Padding, as a fraction of the shorter side of what is being wrapped.
 *
 * Proportional because a circle around a 60px badge and one around a 600px
 * diagram do not want the same gap — a fixed 16px reads as tight on one and
 * invisible on the other. The floor and ceiling stop it collapsing onto small
 * ink or ballooning around a drawing that spans the board.
 */
const PAD_RATIO = 0.08;
const PAD_MIN = 14;
const PAD_MAX = 46;

/** How far the padding may be squeezed before the shape is downgraded. */
const PAD_SQUEEZE = [1, 0.66, 0.4] as const;

/** No emphasis may come closer than this to the edge of the board. */
const BOARD_MARGIN = 26;

/**
 * The largest share of the board one emphasis may cover.
 *
 * Past this it has stopped pointing at anything: a shape around 40% of the
 * board is a frame, and a frame says "all of this", which is what the board
 * already said. It is the clearest signal that the target was too big.
 */
const MAX_AREA_SHARE = 0.38;

/**
 * How far past the ink an ellipse reaches.
 *
 * An ellipse only contains a rectangle's corners at √2 of its half-sides, and
 * sizing for that is what made these things enormous. A person drawing a lasso
 * does not contain the corners either — they clip them, and it still reads as
 * "this one". 1.14 wraps the ink and leaves the corners to fend for themselves.
 */
const CIRCLE_GROW = 1.14;

/** Past this width-to-height ratio an ellipse is a squashed band, not a ring. */
const CIRCLE_MAX_ASPECT = 3.1;

/** Underline: how far under the writing line it sits, per unit of type size. */
const UNDERLINE_DROP = 0.2;
/** And how far past the text it runs at each end, likewise. */
const UNDERLINE_OVERSHOOT = 0.14;

const STROKE_WIDTH: Record<EmphasisShape, number> = {
  underline: 7,
  strike: 6,
  box: 5,
  circle: 5,
  brace: 5,
};

/** What each shape becomes when it does not fit. `null` ends the ladder. */
const DOWNGRADE: Record<EmphasisShape, EmphasisShape | null> = {
  circle: "box",
  brace: "box",
  box: "underline",
  strike: "underline",
  underline: null,
};

/* -------------------------------------------------------------------------- */
/*                                   Target                                   */
/* -------------------------------------------------------------------------- */

/** The last written row of a target, when it ends in text. */
export interface WrittenRow {
  box: Box;
  /** The y the glyphs sit on — what an underline belongs just below. */
  writingLine: number;
  fontSize: number;
}

export interface EmphasisTarget {
  /** The box the target's ink really occupies. */
  ink: Box;
  /** Present when the target is, or ends in, written text. */
  row?: WrittenRow;
}

export interface EmphasisContext {
  target: EmphasisTarget;
  /**
   * Ink the shape may not cross: the title, and everything belonging to a slot
   * other than the one being emphasised.
   */
  avoid: Box[];
}

export interface PlannedEmphasis {
  parts: Part[];
  /**
   * The box the shape actually draws in — not the target.
   *
   * The camera frames what a step reports here, so reporting the target is how
   * an emphasis ends up half off screen while every camera check passes.
   */
  bounds: Box;
  /** The shape that survived; may not be the one that was asked for. */
  shape: EmphasisShape | null;
  warning?: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

const paddingFor = (ink: Box, squeeze: number) =>
  Math.min(PAD_MAX, Math.max(PAD_MIN, Math.min(ink.w, ink.h) * PAD_RATIO)) * squeeze;

function shapePaths(
  shape: EmphasisShape,
  { ink, row }: EmphasisTarget,
  pad: number,
): string[] | null {
  const { x, y, w, h } = ink;

  switch (shape) {
    case "underline": {
      // End to end of the text that was measured, a little under the line the
      // glyphs sit on, with a slight run-out either side. Never the width of
      // the block: a wrapped title's last row is usually far narrower, and an
      // underline at block width underlines empty board.
      const span = row?.box ?? ink;
      const size = row?.fontSize ?? Math.min(h, 72);
      const overshoot = size * UNDERLINE_OVERSHOOT;
      const baseline = (row?.writingLine ?? y + h) + size * UNDERLINE_DROP;
      return roughLine(
        span.x - overshoot,
        baseline,
        span.x + span.w + overshoot,
        baseline + 3,
        { bowing: 1.1 },
      );
    }

    case "strike": {
      const span = row?.box ?? ink;
      const middle = row ? row.box.y + row.box.h * 0.52 : y + h / 2;
      return roughLine(span.x - pad * 0.3, middle, span.x + span.w + pad * 0.3, middle, {
        bowing: 0.9,
      });
    }

    case "box":
      return roughRect(x - pad, y - pad, w + pad * 2, h + pad * 2);

    case "circle": {
      // A long, low target cannot be ringed without the ring becoming a band.
      if (w / Math.max(1, h) > CIRCLE_MAX_ASPECT) return null;
      return roughEllipse(
        x + w / 2,
        y + h / 2,
        (w / 2) * CIRCLE_GROW + pad,
        (h / 2) * CIRCLE_GROW + pad,
        { bowing: 0.9 },
      );
    }

    case "brace": {
      const left = x - pad;
      const top = y - pad / 2;
      const bottom = y + h + pad / 2;
      return roughQuadratic([left + 26, top], [left - 6, (top + bottom) / 2], [left + 26, bottom], {
        bowing: 0.4,
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Checking                                  */
/* -------------------------------------------------------------------------- */

const SAFE: Box = {
  x: BOARD_MARGIN,
  y: BOARD_MARGIN,
  w: BOARD.width - BOARD_MARGIN * 2,
  h: BOARD.height - BOARD_MARGIN * 2,
};

function insideBoard(box: Box): boolean {
  return (
    box.x >= SAFE.x &&
    box.y >= SAFE.y &&
    box.x + box.w <= SAFE.x + SAFE.w &&
    box.y + box.h <= SAFE.y + SAFE.h
  );
}

/**
 * Whether the strokes really pass through a box.
 *
 * Tested against the sampled points rather than the shape's bounding box: the
 * corners of an ellipse's bounds are empty, and refusing a shape because a
 * corner of the box it does not occupy overlaps a neighbour would downgrade
 * perfectly good emphasis.
 */
function strokesEnter(paths: string[], box: Box): boolean {
  for (const d of paths) {
    for (const point of samplePath(d).points) {
      if (
        point.x >= box.x &&
        point.x <= box.x + box.w &&
        point.y >= box.y &&
        point.y <= box.y + box.h
      ) {
        return true;
      }
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*                                    Plan                                    */
/* -------------------------------------------------------------------------- */

/**
 * The best shape that fits, or nothing.
 *
 * Never throws and never returns something that does not fit: the worst case is
 * `shape: null` with a warning, and a step that draws nothing.
 */
export function planEmphasis(
  wanted: EmphasisShape,
  context: EmphasisContext,
  color?: MarkColor,
): PlannedEmphasis {
  const { target, avoid } = context;
  const reasons: string[] = [];

  let shape: EmphasisShape | null = wanted;

  while (shape) {
    for (const squeeze of PAD_SQUEEZE) {
      const paths = shapePaths(shape, target, paddingFor(target.ink, squeeze));
      if (!paths || paths.length === 0) {
        reasons.push(`${shape} no es dibujable sobre un objetivo tan apaisado`);
        break;
      }

      const part = boardStrokes(paths, STROKE_WIDTH[shape], color);
      // Measured off the strokes Rough.js produced, so the wobble counts. With
      // no DOM to measure against there is nothing to check, and the shape is
      // taken as drawn — the same thing the engine did everywhere before.
      const bounds = partsBounds([part]);
      if (!bounds) {
        return { parts: [part], bounds: target.ink, shape };
      }

      if (!insideBoard(bounds)) {
        if (squeeze === PAD_SQUEEZE[PAD_SQUEEZE.length - 1]) {
          reasons.push(`${shape} no cabe en el tablero`);
        }
        continue;
      }

      const share = boxArea(bounds) / (BOARD.width * BOARD.height);
      if (share > MAX_AREA_SHARE) {
        if (squeeze === PAD_SQUEEZE[PAD_SQUEEZE.length - 1]) {
          reasons.push(`${shape} abarcaría el ${(share * 100).toFixed(0)}% del tablero`);
        }
        continue;
      }

      const hit = avoid.find((box) => strokesEnter(paths, box));
      if (hit) {
        if (squeeze === PAD_SQUEEZE[PAD_SQUEEZE.length - 1]) {
          reasons.push(`${shape} cruza tinta que no es suya`);
        }
        continue;
      }

      return {
        parts: [part],
        bounds,
        shape,
        warning:
          shape === wanted
            ? undefined
            : `énfasis "${wanted}" degradado a "${shape}": ${reasons[0]}`,
      };
    }

    shape = DOWNGRADE[shape];
  }

  return {
    parts: [],
    bounds: target.ink,
    shape: null,
    warning: `énfasis "${wanted}" omitido: ${reasons[0] ?? "no cabe en ninguna forma"}`,
  };
}
