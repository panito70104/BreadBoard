"use client";

/**
 * Strokes a set of paths as if a marker were drawing them.
 *
 * Two ways, chosen by `strokeStyle`:
 *
 * **`"rough"`** — the original, and still the default. Each path is stroked at
 * one width and revealed with a dash offset. `pathLength={1}` normalizes every
 * path to a unit length, so one offset value works regardless of how long the
 * real geometry is — without it, a short path and a long one drawn with the
 * same dash array finish at different times. Nothing is recomputed per frame:
 * only the offset attribute changes.
 *
 * **`"freehand"`** — the line's thickness follows the speed of the tip, so it
 * thins where the marker is moving and tapers at both ends. The outline has to
 * be rebuilt as the stroke grows, so it costs real work per frame, but only for
 * the one stroke actually being drawn: the finished ones are cached
 * (`lib/engine/freehand.ts`).
 *
 * How far along each path is does not come from here either way. The pen
 * schedule decides it, because the same numbers have to place the hand: if this
 * file worked out its own shares, the marker would drift off its own line the
 * moment the two disagreed about a lift or a pause.
 */

import { DEFAULT_STROKE_STYLE, freehandOutline, type StrokeStyle } from "@/lib/engine/freehand";

export interface DrawnPathsProps {
  paths: string[];
  /** How much of each path is inked, 0–1, one entry per path. */
  shares: number[];
  color: string;
  strokeWidth: number;
  /** Viewport of the path coordinates. */
  viewBox: string;
  width: number;
  height: number;
  opacity?: number;
  strokeStyle?: StrokeStyle;
  /** Seconds the pen schedule gives each path — `freehand` reads pressure off it. */
  strokeSeconds?: number[];
  /** Board pixels one unit of the path space becomes. */
  unitScale?: number;
}

export function DrawnPaths({
  paths,
  shares,
  color,
  strokeWidth,
  viewBox,
  width,
  height,
  opacity = 1,
  strokeStyle = DEFAULT_STROKE_STYLE,
  strokeSeconds,
  unitScale = 1,
}: DrawnPathsProps) {
  const freehand = strokeStyle === "freehand";

  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill={freehand ? color : "none"}
      stroke={freehand ? "none" : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, overflow: "visible" }}
      aria-hidden
    >
      {paths.map((d, index) => {
        const share = shares[index] ?? 0;
        if (share <= 0) return null;

        if (freehand) {
          const outline = freehandOutline(d, share, {
            width: strokeWidth,
            unitScale,
            seconds: strokeSeconds?.[index] ?? 0.2,
          });
          if (!outline) return null;
          return <path key={`${index}-${d.length}`} d={outline} />;
        }

        return (
          <path
            key={`${index}-${d.length}`}
            d={d}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - share}
          />
        );
      })}
    </svg>
  );
}
