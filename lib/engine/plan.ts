/**
 * Resolves a scene's steps into concrete board geometry.
 *
 * The storyboard only says "a bullet in `list`". Turning that into pixels needs
 * things the model never provides: what else lives in that slot, how tall each
 * piece really is once wrapped, what `prev` points to, and what an underline
 * should hug. The plan answers all of it once per scene, so the renderer and
 * the hand read the same numbers every frame.
 *
 * Within a slot, content stacks top to bottom in the order it is drawn. Text
 * takes its measured height; drawings share whatever is left. If it does not
 * fit, everything in the slot is scaled down together — never overlapped.
 */

import { ICON_PATHS, ICON_VIEWBOX } from "@/data/icon-paths";
import { FONT_SIZE, HAND_FONT, slotBox, type Box } from "@/lib/engine/board";
import { diagramParts } from "@/lib/engine/diagrams";
import {
  boardStrokes,
  partWindows,
  type Part,
  type PartWindow,
} from "@/lib/engine/parts";
import {
  roughArrowhead,
  roughEllipse,
  roughLine,
  roughPath,
  roughPolyline,
  roughQuadratic,
  roughRect,
} from "@/lib/engine/rough";
import { layoutText } from "@/lib/engine/text";
import type { TimedScene, TimedStep } from "@/lib/engine/timeline";
import type {
  BulletElement,
  DrawElement,
  EmphasisElement,
  SceneLayout,
  Slot,
} from "@/types/storyboard";

export interface PlacedStep {
  timed: TimedStep;
  element: DrawElement;
  parts: Part[];
  windows: PartWindow[];
  /** The ink this step leaves, for emphasis and arrows to point at. */
  bounds: Box;
}

export interface ScenePlan {
  scene: TimedScene;
  steps: PlacedStep[];
}

const GAP = 22;
/** Marker line width on the board, in pixels. */
const MARKER_WIDTH = 7;
const SCALES = [1, 0.9, 0.8, 0.72, 0.64, 0.57, 0.5];
const BULLET_INDENT = 64;

/** Hand-drawn bullet marks, on the 24-unit icon grid. */
const BULLET_GLYPHS: Record<string, string> = {
  dot: "M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  dash: "M6 12h12",
  check: "M5 13l4 5 10-12",
  arrow: "M5 12h12l-5-5m5 5l-5 5",
  star: "M12 4l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 10.4l6-.8z",
};

type FlowElement = Extract<DrawElement, { type: "title" | "text" | "bullet" | "formula" }>;
type VisualElement = Extract<DrawElement, { type: "icon" | "diagram" }>;

function isFlow(element: DrawElement): element is FlowElement {
  return ["title", "text", "bullet", "formula"].includes(element.type);
}

function isVisual(element: DrawElement): element is VisualElement {
  return element.type === "icon" || element.type === "diagram";
}

function slotOf(element: FlowElement | VisualElement): Slot {
  return element.type === "title" ? "title" : element.slot;
}

function union(a: Box | null | undefined, b: Box): Box {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Flow content                               */
/* -------------------------------------------------------------------------- */

interface Measured {
  height: number;
  /** Builds the parts once the vertical position is known. */
  build: (x: number, y: number) => { parts: Part[]; bounds: Box };
}

function measureFlow(
  element: FlowElement,
  width: number,
  scale: number,
  bulletNumber: number,
): Measured {
  const color = "color" in element ? element.color : undefined;

  if (element.type === "bullet") {
    return measureBullet(element, width, scale, bulletNumber);
  }

  const fontSize =
    (element.type === "title"
      ? FONT_SIZE.title
      : element.type === "formula"
        ? FONT_SIZE.formula
        : FONT_SIZE[element.size ?? "md"]) * scale;
  const layout = layoutText(element.text, { fontSize, fontFamily: HAND_FONT, maxWidth: width });
  const centred = element.type === "formula";

  return {
    height: layout.height,
    build: (x, y) => {
      const left = centred ? x + (width - layout.width) / 2 : x;
      return {
        parts: [{ kind: "text", text: element.text, layout, x: left, y, fontSize, color: color ?? undefined }],
        bounds: { x: left, y, w: layout.width, h: layout.height },
      };
    },
  };
}

function measureBullet(
  element: BulletElement,
  width: number,
  scale: number,
  bulletNumber: number,
): Measured {
  const fontSize = FONT_SIZE.bullet * scale;
  const indent = BULLET_INDENT * scale;
  const layout = layoutText(element.text, {
    fontSize,
    fontFamily: HAND_FONT,
    maxWidth: width - indent,
  });
  const color = element.color ?? undefined;

  return {
    height: layout.height,
    build: (x, y) => {
      const markerSize = fontSize * 0.85;
      const marker: Part =
        element.marker === "number"
          ? (() => {
              const label = `${bulletNumber}.`;
              const numberLayout = layoutText(label, { fontSize, fontFamily: HAND_FONT, maxWidth: indent });
              return { kind: "text", text: label, layout: numberLayout, x, y, fontSize, color } as Part;
            })()
          : {
              kind: "strokes",
              paths: roughPath(BULLET_GLYPHS[element.marker ?? "dot"] ?? BULLET_GLYPHS.dot, {
                roughness: 0.4,
                bowing: 0.3,
              }),
              viewBox: { w: ICON_VIEWBOX, h: ICON_VIEWBOX },
              frame: { x, y: y + fontSize * 0.28, w: markerSize, h: markerSize },
              strokeWidth: 2,
              color,
            };

      return {
        parts: [
          marker,
          { kind: "text", text: element.text, layout, x: x + indent, y, fontSize, color },
        ],
        bounds: { x, y, w: indent + layout.width, h: layout.height },
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Visuals                                  */
/* -------------------------------------------------------------------------- */

function buildVisual(element: VisualElement, region: Box, scale: number) {
  if (element.type === "diagram") {
    const parts = diagramParts(element, region, scale);
    return { parts, bounds: region };
  }

  const wanted = Math.min(1.3, Math.max(0.4, element.scale ?? 1));
  const size = Math.min(region.w, region.h) * Math.min(0.92, 0.78 * wanted);
  const frame = {
    x: region.x + (region.w - size) / 2,
    y: region.y + (region.h - size) / 2,
    w: size,
    h: size,
  };
  const paths = (ICON_PATHS[element.id] ?? []).flatMap((d) =>
    roughPath(d, { roughness: 0.5, bowing: 0.6, strokeWidth: 0.9 }),
  );
  const parts: Part[] = [
    {
      kind: "strokes",
      paths,
      viewBox: { w: ICON_VIEWBOX, h: ICON_VIEWBOX },
      frame,
      // A marker has one thickness whatever it draws: ~7px on the board,
      // expressed in icon units so big icons do not turn into blobs.
      strokeWidth: (MARKER_WIDTH * ICON_VIEWBOX) / size,
      color: element.color ?? undefined,
    },
  ];
  return { parts, bounds: frame };
}

/** Diagrams deserve more room than a decorative icon sharing their slot. */
const visualWeight = (element: VisualElement) => (element.type === "diagram" ? 2 : 1);

/* -------------------------------------------------------------------------- */
/*                                Slot layout                                 */
/* -------------------------------------------------------------------------- */

interface SlotItem {
  index: number;
  element: FlowElement | VisualElement;
}

function arrangeSlot(region: Box, items: SlotItem[]) {
  const flows = items.filter((item) => isFlow(item.element));
  const visuals = items.filter((item) => isVisual(item.element));
  const minVisual = visuals.length ? Math.max(150, region.h * 0.38) : 0;

  const numberOf = new Map<number, number>();
  let numbered = 0;
  for (const item of flows) {
    const element = item.element;
    if (element.type === "bullet" && element.marker === "number") {
      numbered += 1;
      numberOf.set(item.index, numbered);
    }
  }

  // Largest scale at which the text leaves room for the drawings.
  let scale = SCALES[SCALES.length - 1];
  let measured = new Map<number, Measured>();
  let flowHeight = 0;
  for (const candidate of SCALES) {
    measured = new Map(
      flows.map((item) => [
        item.index,
        measureFlow(item.element as FlowElement, region.w, candidate, numberOf.get(item.index) ?? 1),
      ]),
    );
    flowHeight =
      [...measured.values()].reduce((sum, m) => sum + m.height, 0) +
      GAP * Math.max(0, flows.length - 1);
    const needed = flowHeight + (flows.length && visuals.length ? GAP : 0) + minVisual;
    scale = candidate;
    if (needed <= region.h) break;
  }

  const result = new Map<number, { parts: Part[]; bounds: Box }>();

  // Drawings only: side by side when the slot is wide, stacked otherwise.
  if (!flows.length && visuals.length > 1 && region.w > region.h * 1.1) {
    const totalWeight = visuals.reduce((sum, item) => sum + visualWeight(item.element as VisualElement), 0);
    const usable = region.w - GAP * (visuals.length - 1);
    let x = region.x;
    for (const item of visuals) {
      const w = (usable * visualWeight(item.element as VisualElement)) / totalWeight;
      result.set(item.index, buildVisual(item.element as VisualElement, { x, y: region.y, w, h: region.h }, scale));
      x += w + GAP;
    }
    return result;
  }

  const totalWeight = visuals.reduce((sum, item) => sum + visualWeight(item.element as VisualElement), 0);
  const visualSpace = Math.max(
    minVisual,
    region.h - flowHeight - (flows.length && visuals.length ? GAP : 0) - GAP * Math.max(0, visuals.length - 1),
  );

  let y = region.y;
  for (const item of items) {
    if (isFlow(item.element)) {
      const m = measured.get(item.index)!;
      result.set(item.index, m.build(region.x, y));
      y += m.height + GAP;
    } else {
      const h = (visualSpace * visualWeight(item.element as VisualElement)) / (totalWeight || 1);
      result.set(item.index, buildVisual(item.element as VisualElement, { x: region.x, y, w: region.w, h }, scale));
      y += h + GAP;
    }
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*                            Emphasis and arrows                             */
/* -------------------------------------------------------------------------- */

function emphasisPaths(element: EmphasisElement, target: Box): string[] {
  const pad = 16;
  const { x, y, w, h } = target;
  switch (element.shape) {
    case "underline":
      return roughLine(x - 6, y + h + 2, x + w + 10, y + h + 6, { bowing: 2.6 });
    case "strike":
      return roughLine(x - 4, y + h / 2, x + w + 4, y + h / 2);
    case "box":
      return roughRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
    case "circle":
      // An ellipse only contains a rectangle's corners at ~√2 its half-sides.
      return roughEllipse(x + w / 2, y + h / 2, (w / 2) * 1.2 + pad, (h / 2) * 1.45 + pad);
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

function arrowPaths(from: Box, to: Box): string[] {
  const fromCentre = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCentre = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const horizontal = Math.abs(toCentre.x - fromCentre.x) >= Math.abs(toCentre.y - fromCentre.y);

  let start: [number, number];
  let tip: [number, number];
  if (horizontal) {
    const rightward = toCentre.x > fromCentre.x;
    start = [rightward ? from.x + from.w + 14 : from.x - 14, fromCentre.y];
    tip = [rightward ? to.x - 14 : to.x + to.w + 14, toCentre.y];
  } else {
    const downward = toCentre.y > fromCentre.y;
    start = [fromCentre.x, downward ? from.y + from.h + 14 : from.y - 14];
    tip = [toCentre.x, downward ? to.y - 14 : to.y + to.h + 14];
  }
  if (Math.hypot(tip[0] - start[0], tip[1] - start[1]) < 40) return [];
  return [...roughPolyline([start, tip]), ...roughArrowhead(tip, start, 30)];
}

/* -------------------------------------------------------------------------- */
/*                                   Plan                                     */
/* -------------------------------------------------------------------------- */

export function planScene(scene: TimedScene): ScenePlan {
  const layout: SceneLayout = scene.scene.layout;

  // 1. Group content by slot, in drawing order, and lay each slot out.
  const bySlot = new Map<Slot, SlotItem[]>();
  scene.steps.forEach((timed, index) => {
    const element = timed.step.draw;
    if (isFlow(element) || isVisual(element)) {
      const slot = slotOf(element);
      bySlot.set(slot, [...(bySlot.get(slot) ?? []), { index, element }]);
    }
  });

  const arranged = new Map<number, { parts: Part[]; bounds: Box }>();
  for (const [slot, items] of bySlot) {
    for (const [index, placed] of arrangeSlot(slotBox(layout, slot), items)) {
      arranged.set(index, placed);
    }
  }

  // Where each slot's content will end up once fully drawn — so an arrow drawn
  // before its destination fills in still points at where the content lands.
  const plannedInk = new Map<Slot, Box>();
  for (const [slot, items] of bySlot) {
    for (const item of items) {
      plannedInk.set(slot, union(plannedInk.get(slot), arranged.get(item.index)!.bounds));
    }
  }

  // 2. Walk in time order: emphasis and arrows point at ink drawn so far.
  const inkBySlot = new Map<Slot, Box>();
  let lastInk: Box | null = null;

  const steps = scene.steps.map((timed, index): PlacedStep => {
    const element = timed.step.draw;
    let parts: Part[] = [];
    let bounds: Box = slotBox(layout, "center");

    if (isFlow(element) || isVisual(element)) {
      const placed = arranged.get(index)!;
      parts = placed.parts;
      bounds = placed.bounds;
      const slot = slotOf(element);
      inkBySlot.set(slot, union(inkBySlot.get(slot), bounds));
      lastInk = bounds;
    } else if (element.type === "emphasis") {
      const target =
        element.target === "prev"
          ? (lastInk ?? slotBox(layout, "title"))
          : (inkBySlot.get(element.target) ?? slotBox(layout, element.target));
      parts = [boardStrokes(emphasisPaths(element, target), element.shape === "underline" ? 7 : 5)];
      bounds = target;
    } else if (element.type === "arrow") {
      const from =
        inkBySlot.get(element.from) ?? plannedInk.get(element.from) ?? slotBox(layout, element.from);
      const to = plannedInk.get(element.to) ?? slotBox(layout, element.to);
      parts = [boardStrokes(arrowPaths(from, to), 5)];
      bounds = union(from, to);
    } else if (element.type === "erase") {
      bounds =
        element.scope === "board"
          ? { x: 0, y: 0, w: 1920, h: 1080 }
          : slotBox(layout, element.scope);
      if (element.scope === "board") inkBySlot.clear();
      else inkBySlot.delete(element.scope);
      lastInk = null;
    }

    return { timed, element, parts, windows: partWindows(parts), bounds };
  });

  return { scene, steps };
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
