"use client";

/**
 * Renders one storyboard element being drawn, and tells the hand where the
 * marker tip is.
 *
 * Each element type exports its visual and its pen position from the same
 * geometry, so the drawing and the hand can never disagree about where the
 * stroke currently ends.
 */

import { ICON_PATHS, ICON_VIEWBOX } from "@/data/icon-paths";
import { FONT_SIZE, type BoardTheme, type Box } from "@/lib/engine/board";
import { penPoint } from "@/lib/engine/path-sampling";
import { roughEllipse, roughLine, roughPath, roughRect } from "@/lib/engine/rough";
import { layoutText, writingHead } from "@/lib/engine/text";
import type { PlacedStep } from "@/lib/engine/plan";
import type { DrawElement, MarkColor } from "@/types/storyboard";

import { DrawnPaths } from "./drawn-paths";
import { DrawnText } from "./drawn-text";

export const HAND_FONT = "var(--font-hand), cursive";

function ink(theme: BoardTheme, color?: MarkColor | null) {
  return color ? theme.colors[color] : theme.ink;
}

function fontSizeFor(element: DrawElement): number {
  switch (element.type) {
    case "title":
      return FONT_SIZE.title;
    case "text":
      return FONT_SIZE[element.size ?? "md"];
    case "bullet":
      return FONT_SIZE.bullet;
    case "formula":
      return FONT_SIZE.formula;
    default:
      return FONT_SIZE.md;
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Geometry                                  */
/* -------------------------------------------------------------------------- */

const BULLET_INDENT = 64;

/** Hand-drawn marks used as bullet points, on a 24 grid. */
const BULLET_GLYPHS: Record<string, string[]> = {
  dot: ["M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0"],
  dash: ["M6 12h12"],
  check: ["M5 13l4 5 10-12"],
  arrow: ["M5 12h12", "M13 7l5 5-5 5"],
  star: ["M12 4l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 10.4l6-.8z"],
  number: ["M9 6h2v12", "M8 18h6"],
};

function emphasisPaths(element: DrawElement, target: Box): string[] {
  if (element.type !== "emphasis") return [];
  const pad = 18;

  switch (element.shape) {
    case "underline":
      return roughLine(
        target.x - 6,
        target.y + target.h + 6,
        target.x + target.w * 0.92,
        target.y + target.h + 10,
        { strokeWidth: 6, bowing: 2.6 },
      );
    case "strike":
      return roughLine(
        target.x,
        target.y + target.h / 2,
        target.x + target.w * 0.95,
        target.y + target.h / 2,
        { strokeWidth: 5 },
      );
    case "box":
      return roughRect(
        target.x - pad,
        target.y - pad,
        target.w + pad * 2,
        target.h + pad * 2,
        { strokeWidth: 4 },
      );
    case "circle":
      return roughEllipse(
        target.x + target.w / 2,
        target.y + target.h / 2,
        target.w / 2 + pad,
        target.h / 2 + pad,
        { strokeWidth: 4 },
      );
    case "brace": {
      const x = target.x - pad;
      const top = target.y - pad;
      const bottom = target.y + target.h + pad;
      const mid = (top + bottom) / 2;
      return roughPath(
        `M${x + 24} ${top}Q${x} ${top} ${x} ${mid}Q${x} ${bottom} ${x + 24} ${bottom}`,
        { strokeWidth: 4 },
      );
    }
  }
}

function arrowPaths(element: DrawElement, from: Box, to: Box): string[] {
  if (element.type !== "arrow") return [];
  const start = { x: from.x + from.w, y: from.y + from.h / 2 };
  const end = { x: to.x - 12, y: to.y + to.h / 2 };

  const shaft =
    element.curve === "arc"
      ? roughPath(
          `M${start.x} ${start.y}Q${(start.x + end.x) / 2} ${
            Math.min(start.y, end.y) - 90
          } ${end.x} ${end.y}`,
          { strokeWidth: 5 },
        )
      : roughLine(start.x, start.y, end.x, end.y, { strokeWidth: 5 });

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 34;
  const wing = (offset: number) =>
    roughLine(
      end.x,
      end.y,
      end.x - head * Math.cos(angle - offset),
      end.y - head * Math.sin(angle - offset),
      { strokeWidth: 5 },
    );

  return [...shaft, ...wing(0.5), ...wing(-0.5)];
}

function diagramPaths(element: DrawElement, box: Box): string[] {
  if (element.type !== "diagram") return [];
  const count = Math.max(1, element.labels.length);
  const paths: string[] = [];

  if (element.kind === "timeline") {
    const y = box.y + box.h * 0.45;
    paths.push(...roughLine(box.x, y, box.x + box.w, y, { strokeWidth: 5 }));
    for (let i = 0; i < count; i += 1) {
      const x = box.x + (box.w * (i + 0.5)) / count;
      paths.push(...roughLine(x, y - 22, x, y + 22, { strokeWidth: 4 }));
    }
    return paths;
  }

  if (element.kind === "axes") {
    paths.push(
      ...roughLine(box.x, box.y, box.x, box.y + box.h, { strokeWidth: 5 }),
      ...roughLine(box.x, box.y + box.h, box.x + box.w, box.y + box.h, { strokeWidth: 5 }),
    );
    return paths;
  }

  // flow / compare / cycle / tree all read as linked boxes.
  const cellW = box.w / count - 26;
  const cellH = Math.min(box.h * 0.5, 170);
  const y = box.y + (box.h - cellH) / 2;
  for (let i = 0; i < count; i += 1) {
    const x = box.x + i * (cellW + 26);
    paths.push(...roughRect(x, y, cellW, cellH, { strokeWidth: 4 }));
    if (i > 0) {
      paths.push(
        ...roughLine(x - 26, y + cellH / 2, x - 6, y + cellH / 2, { strokeWidth: 4 }),
      );
    }
  }
  return paths;
}

function iconPaths(element: DrawElement): string[] {
  if (element.type !== "icon") return [];
  const raw = ICON_PATHS[element.id] ?? [];
  return raw.flatMap((d) => roughPath(d, { roughness: 0.55, bowing: 0.7, strokeWidth: 0.9 }));
}

function iconFrame(box: Box, scale: number) {
  const size = Math.min(box.w, box.h) * 0.72 * scale;
  return {
    size,
    left: box.x + (box.w - size) / 2,
    top: box.y + (box.h - size) / 2,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Head                                    */
/* -------------------------------------------------------------------------- */

/** Board coordinates of the marker tip, or null when nothing is being drawn. */
export function elementHead(
  placed: PlacedStep,
  progress: number,
): { x: number; y: number } | null {
  const { element, box, target } = placed;

  switch (element.type) {
    case "title":
    case "text":
    case "bullet":
    case "formula": {
      const isBullet = element.type === "bullet";
      const fontSize = fontSizeFor(element);
      const maxWidth = box.w - (isBullet ? BULLET_INDENT : 0);
      const layout = layoutText(element.text, {
        fontSize,
        fontFamily: HAND_FONT,
        maxWidth,
      });
      const head = writingHead(layout, progress);
      return {
        x: box.x + (isBullet ? BULLET_INDENT : 0) + head.x,
        y: box.y + head.y,
      };
    }

    case "icon": {
      const paths = iconPaths(element);
      const point = penPoint(paths, progress);
      if (!point) return null;
      const frame = iconFrame(box, element.scale ?? 1);
      return {
        x: frame.left + (point.x / ICON_VIEWBOX) * frame.size,
        y: frame.top + (point.y / ICON_VIEWBOX) * frame.size,
      };
    }

    case "emphasis":
      return target ? penPoint(emphasisPaths(element, target), progress) : null;

    case "arrow":
      return target ? penPoint(arrowPaths(element, box, target), progress) : null;

    case "diagram":
      return penPoint(diagramPaths(element, box), progress);

    case "erase":
      return { x: box.x + box.w * progress, y: box.y + box.h / 2 };
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Render                                   */
/* -------------------------------------------------------------------------- */

export interface DrawElementProps {
  placed: PlacedStep;
  progress: number;
  theme: BoardTheme;
}

export function DrawElementView({ placed, progress, theme }: DrawElementProps) {
  const { element, box, target } = placed;
  const color = ink(theme, "color" in element ? element.color : undefined);

  if (element.type === "erase") return null;

  if (
    element.type === "title" ||
    element.type === "text" ||
    element.type === "formula"
  ) {
    return (
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w }}>
        <DrawnText
          text={element.text}
          fontSize={fontSizeFor(element)}
          fontFamily={HAND_FONT}
          maxWidth={box.w}
          color={color}
          progress={progress}
        />
      </div>
    );
  }

  if (element.type === "bullet") {
    const glyph = BULLET_GLYPHS[element.marker ?? "dot"] ?? BULLET_GLYPHS.dot;
    const markerSize = FONT_SIZE.bullet * 0.9;
    return (
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w }}>
        <div style={{ position: "absolute", left: 0, top: FONT_SIZE.bullet * 0.25 }}>
          <DrawnPaths
            paths={glyph}
            progress={Math.min(1, progress * 3)}
            color={color}
            strokeWidth={2}
            viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
            width={markerSize}
            height={markerSize}
          />
        </div>
        <div style={{ position: "absolute", left: BULLET_INDENT, top: 0 }}>
          <DrawnText
            text={element.text}
            fontSize={FONT_SIZE.bullet}
            fontFamily={HAND_FONT}
            maxWidth={box.w - BULLET_INDENT}
            color={color}
            progress={progress}
          />
        </div>
      </div>
    );
  }

  if (element.type === "icon") {
    const frame = iconFrame(box, element.scale ?? 1);
    return (
      <div style={{ position: "absolute", left: frame.left, top: frame.top }}>
        <DrawnPaths
          paths={iconPaths(element)}
          progress={progress}
          color={color}
          strokeWidth={0.95}
          viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
          width={frame.size}
          height={frame.size}
        />
      </div>
    );
  }

  const paths =
    element.type === "emphasis"
      ? target
        ? emphasisPaths(element, target)
        : []
      : element.type === "arrow"
        ? arrowPaths(element, box, target ?? box)
        : diagramPaths(element, box);

  if (paths.length === 0) return null;

  return (
    <div style={{ position: "absolute", left: 0, top: 0 }}>
      <DrawnPaths
        paths={paths}
        progress={progress}
        color={color}
        strokeWidth={5}
        viewBox="0 0 1920 1080"
        width={1920}
        height={1080}
      />
    </div>
  );
}
