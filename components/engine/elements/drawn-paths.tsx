"use client";

/**
 * Strokes a set of paths as if a marker were drawing them.
 *
 * `pathLength={1}` normalizes every path to a unit length, so one dash offset
 * value works regardless of how long the real geometry is — without it, a short
 * path and a long one drawn with the same dash array finish at different times.
 *
 * How far along each path is does not come from here. The pen schedule decides
 * it, because the same numbers have to place the hand: if this file worked out
 * its own shares, the marker would drift off its own line the moment the two
 * disagreed about a lift or a pause.
 */

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
}: DrawnPathsProps) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, overflow: "visible" }}
      aria-hidden
    >
      {paths.map((d, index) => {
        const share = shares[index] ?? 0;
        if (share <= 0) return null;
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
