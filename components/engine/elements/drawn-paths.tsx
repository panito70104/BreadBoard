"use client";

/**
 * Strokes a set of paths as if a marker were drawing them.
 *
 * `pathLength={1}` normalizes every path to a unit length, so one dash offset
 * value works regardless of how long the real geometry is — without it, a short
 * path and a long one drawn with the same dash array finish at different times.
 */

import { perPathProgress } from "@/lib/engine/path-sampling";

export interface DrawnPathsProps {
  paths: string[];
  /** 0–1 through the whole set. */
  progress: number;
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
  progress,
  color,
  strokeWidth,
  viewBox,
  width,
  height,
  opacity = 1,
}: DrawnPathsProps) {
  const shares = perPathProgress(paths, progress);

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
        const share = shares[index];
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
