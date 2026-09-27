"use client";

import { writingHead, type TextLayout } from "@/lib/engine/text";

export interface DrawnTextProps {
  layout: TextLayout;
  /** Top-left of the block on the board. */
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  /** 0–1 through the writing of this block. */
  progress: number;
}

/**
 * Handwritten text that writes itself, word by word. The word being written
 * is clipped so it grows left to right, which is what lets the hand sit on the
 * growing edge instead of hopping between finished words.
 */
export function DrawnText({ layout, x, y, fontSize, fontFamily, color, progress }: DrawnTextProps) {
  const head = writingHead(layout, progress);

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
        if (index > head.visibleWords) return null;
        const clip =
          index === head.visibleWords && progress < 1
            ? `inset(0 ${Math.max(0, (1 - head.partial) * 100)}% 0 0)`
            : undefined;
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
