"use client";

import { WRITING_LINE, wordPen, type TextLayout } from "@/lib/engine/text";

/**
 * The reveal edge leans with the script, the way the stroke that made it would.
 *
 * A vertical edge is what gives a wipe away: it slices letters in half along an
 * axis no pen ever travels. Twelve degrees is roughly the slant of the
 * handwriting face, so the boundary looks like the last stroke drawn rather
 * than like a blind coming down.
 */
const SLANT = Math.tan((12 * Math.PI) / 180);

export interface DrawnTextProps {
  layout: TextLayout;
  /** Top-left of the block on the board. */
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  /** How much of each word is written, 0–1, one entry per word. */
  wordProgress: number[];
}

/**
 * Handwritten text that writes itself.
 *
 * The word being written is clipped at the pen, and the pen moves character by
 * character — into a letter, a beat at its end, into the next — because that is
 * what separates writing from revealing. The position comes from the same
 * `wordPen` the hand is placed with, so the tip always sits exactly on the edge
 * of what has appeared.
 */
export function DrawnText({
  layout,
  x,
  y,
  fontSize,
  fontFamily,
  color,
  wordProgress,
}: DrawnTextProps) {
  const lean = SLANT * layout.lineHeight;
  const above = lean * WRITING_LINE;
  const below = lean * (1 - WRITING_LINE);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: layout.width + fontSize,
        height: layout.height,
        fontFamily,
        fontSize,
        color,
        lineHeight: `${layout.lineHeight}px`,
        whiteSpace: "pre",
      }}
    >
      {layout.words.map((word, index) => {
        const progress = wordProgress[index] ?? 0;
        if (progress <= 0) return null;

        let clip: string | undefined;
        if (progress < 1) {
          const pen = wordPen(word, progress);
          // The edge pivots on the writing line, where the tip is, and is
          // extrapolated past the box so the slant holds across ascenders and
          // descenders instead of bending at the edges.
          const top = pen + above;
          const bottom = pen - below;
          clip = `polygon(-400px -100%, ${2 * top - bottom}px -100%, ${2 * bottom - top}px 200%, -400px 200%)`;
        }

        return (
          <span
            key={`${word.text}-${index}`}
            style={{ position: "absolute", left: word.x, top: word.y, clipPath: clip }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}
