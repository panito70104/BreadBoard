"use client";

import { layoutText, writingHead } from "@/lib/engine/text";
import { cn } from "@/lib/utils";

export interface DrawnTextProps {
  text: string;
  fontSize: number;
  fontFamily: string;
  maxWidth: number;
  color: string;
  /** 0–1 through the writing of this block. */
  progress: number;
  align?: "left" | "center";
  className?: string;
}

/**
 * Handwritten text that writes itself.
 *
 * Words are revealed one at a time, and the word currently being written is
 * clipped horizontally so it grows left to right. That is what lets the hand
 * sit on the growing edge instead of popping between finished words.
 */
export function DrawnText({
  text,
  fontSize,
  fontFamily,
  maxWidth,
  color,
  progress,
  align = "left",
  className,
}: DrawnTextProps) {
  const layout = layoutText(text, { fontSize, fontFamily, maxWidth });
  const head = writingHead(layout, progress);

  return (
    <div
      className={cn(className)}
      style={{
        position: "relative",
        width: maxWidth,
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
            style={{
              position: "absolute",
              left: align === "center" ? word.x + (maxWidth - layout.width) / 2 : word.x,
              top: word.y,
              clipPath: clip,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

/** Where the marker tip should be, relative to the block's top-left. */
export function textHead(
  text: string,
  options: { fontSize: number; fontFamily: string; maxWidth: number },
  progress: number,
) {
  const layout = layoutText(text, options);
  return writingHead(layout, progress);
}
