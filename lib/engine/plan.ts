/**
 * Resolves a scene's steps into concrete board geometry.
 *
 * The storyboard only says "a bullet in `list`". Turning that into pixels needs
 * state the model never provides: how many bullets are already in that slot,
 * what `prev` refers to, which box an emphasis should wrap. The plan walks the
 * steps once, in order, and answers all of it — so both the renderer and the
 * hand read the same numbers.
 */

import { BOARD, FONT_SIZE, slotBox, type Box } from "@/lib/engine/board";
import type { TimedScene, TimedStep } from "@/lib/engine/timeline";
import type { DrawElement, SceneLayout, Slot } from "@/types/storyboard";

export interface PlacedStep {
  timed: TimedStep;
  element: DrawElement;
  /** Where this element draws, in board pixels. */
  box: Box;
  /** Row inside the slot, for stacked elements like bullets. */
  row: number;
  /** Emphasis: the box being wrapped. Arrow: the destination slot. */
  target?: Box;
}

export interface ScenePlan {
  scene: TimedScene;
  steps: PlacedStep[];
}

const BULLET_ROW_HEIGHT = FONT_SIZE.bullet * 1.9;
const TEXT_ROW_HEIGHT = FONT_SIZE.md * 1.6;

function slotOf(element: DrawElement): Slot {
  switch (element.type) {
    case "title":
      return "title";
    case "arrow":
      return element.from;
    case "emphasis":
      return element.target === "prev" ? "title" : element.target;
    case "erase":
      return element.scope === "board" ? "center" : element.scope;
    default:
      return element.slot;
  }
}

/** Stacked elements consume a row of their slot; everything else fills it. */
function boxFor(element: DrawElement, layout: SceneLayout, row: number): Box {
  const slot = slotOf(element);
  const box = slotBox(layout, slot);

  if (element.type === "bullet") {
    return { x: box.x, y: box.y + row * BULLET_ROW_HEIGHT, w: box.w, h: BULLET_ROW_HEIGHT };
  }
  if (element.type === "text") {
    return { x: box.x, y: box.y + row * TEXT_ROW_HEIGHT, w: box.w, h: TEXT_ROW_HEIGHT };
  }
  return box;
}

export function planScene(scene: TimedScene): ScenePlan {
  const layout = scene.scene.layout;
  const rows = new Map<Slot, number>();
  const placed: PlacedStep[] = [];

  for (const timed of scene.steps) {
    const element = timed.step.draw;
    const slot = slotOf(element);

    const stacks = element.type === "bullet" || element.type === "text";
    const row = stacks ? (rows.get(slot) ?? 0) : 0;
    if (stacks) rows.set(slot, row + 1);

    let target: Box | undefined;
    if (element.type === "arrow") {
      target = slotBox(layout, element.to);
    }
    if (element.type === "emphasis") {
      target =
        element.target === "prev"
          ? placed.at(-1)?.box
          : slotBox(layout, element.target);

      // Emphasis over a stacked slot should wrap everything drawn there so far.
      if (element.target !== "prev") {
        const used = rows.get(element.target) ?? 0;
        if (used > 0) {
          const base = slotBox(layout, element.target);
          target = { ...base, h: Math.min(base.h, used * BULLET_ROW_HEIGHT) };
        }
      }
    }

    placed.push({
      timed,
      element,
      box: boxFor(element, layout, row),
      row,
      target,
    });
  }

  return { scene, steps: placed };
}

/** Frame after which everything drawn before an `erase` should disappear. */
export function eraseFrames(plan: ScenePlan): number[] {
  return plan.steps
    .filter((step) => step.element.type === "erase")
    .map((step) => step.timed.from + step.timed.durationInFrames);
}

/** Steps still visible at `frame`, honouring any erase that has happened. */
export function visibleSteps(plan: ScenePlan, frame: number): PlacedStep[] {
  const lastErase = plan.steps
    .filter(
      (step) =>
        step.element.type === "erase" &&
        frame >= step.timed.from + step.timed.durationInFrames,
    )
    .at(-1);

  return plan.steps.filter((step) => {
    if (step.element.type === "erase") return false;
    if (frame < step.timed.from) return false;
    if (lastErase && step.timed.from < lastErase.timed.from) return false;
    return true;
  });
}

export const BOARD_SIZE = BOARD;
