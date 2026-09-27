/**
 * Board geometry and per-style appearance.
 *
 * The composition is authored at a fixed 1920x1080 and scaled by the player, so
 * every measurement here is in board pixels and the storyboard's normalized
 * slot boxes multiply straight into it.
 */

import { LAYOUTS, resolveSlot } from "@/lib/storyboard/layouts";
import type { MarkColor, SceneLayout, Slot } from "@/types/storyboard";
import type { VideoStyle } from "@/types";

export const BOARD = { width: 1920, height: 1080, fps: 30 } as const;

/** The handwriting face, as a CSS font-family value. */
export const HAND_FONT = "var(--font-hand), cursive";

export interface BoardTheme {
  background: string;
  /** Faint grid or paper ruling drawn under the content. */
  grid: string | null;
  ink: string;
  colors: Record<MarkColor, string>;
}

export const BOARD_THEMES: Record<VideoStyle, BoardTheme> = {
  "classic-whiteboard": {
    background: "#ffffff",
    grid: "rgba(12, 18, 34, 0.05)",
    ink: "#0c1222",
    colors: {
      ink: "#0c1222",
      brand: "#4f46e5",
      amber: "#f59e0b",
      red: "#ef4444",
      green: "#10b981",
      blue: "#3b82f6",
    },
  },
  "paper-desk": {
    background: "#fdf6e3",
    grid: "rgba(120, 90, 40, 0.10)",
    ink: "#3f2d12",
    colors: {
      ink: "#3f2d12",
      brand: "#7c5cff",
      amber: "#c2761a",
      red: "#c0392b",
      green: "#2f7a4f",
      blue: "#2b6cb0",
    },
  },
  "color-markers": {
    background: "#ffffff",
    grid: null,
    ink: "#111827",
    colors: {
      ink: "#111827",
      brand: "#6d28d9",
      amber: "#f59e0b",
      red: "#dc2626",
      green: "#059669",
      blue: "#2563eb",
    },
  },
};

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A layout slot in board pixels. */
export function slotBox(layout: SceneLayout, slot: Slot): Box {
  const box = resolveSlot(layout, slot);
  return {
    x: box.x * BOARD.width,
    y: box.y * BOARD.height,
    w: box.w * BOARD.width,
    h: box.h * BOARD.height,
  };
}

export function slotCenter(layout: SceneLayout, slot: Slot) {
  const box = slotBox(layout, slot);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export function layoutLabel(layout: SceneLayout) {
  return LAYOUTS[layout].label;
}

/** Type scale, in board pixels. */
export const FONT_SIZE = {
  title: 86,
  lg: 62,
  md: 48,
  sm: 38,
  bullet: 46,
  formula: 60,
  label: 32,
} as const;
