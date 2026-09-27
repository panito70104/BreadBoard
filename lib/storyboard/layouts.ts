/**
 * Slot geometry per layout.
 *
 * The model picks a layout and a slot name; these boxes decide where things
 * actually land. Coordinates are normalized to the board (0–1, 16:9), so the
 * same storyboard renders at 1080p or in a preview thumbnail unchanged.
 */

import type { LayoutDefinition, SceneLayout, Slot } from "@/types/storyboard";

export const BOARD_ASPECT = 16 / 9;

export const LAYOUTS: Record<SceneLayout, LayoutDefinition> = {
  "title-only": {
    id: "title-only",
    label: "Solo título",
    description:
      "Apertura o cierre: una idea grande y centrada, sin nada que compita.",
    slots: {
      title: { x: 0.12, y: 0.32, w: 0.76, h: 0.22 },
      center: { x: 0.2, y: 0.57, w: 0.6, h: 0.2 },
      footer: { x: 0.12, y: 0.81, w: 0.76, h: 0.1 },
    },
    fallbackSlot: "center",
  },

  "title-bullets": {
    id: "title-bullets",
    label: "Título y viñetas",
    description:
      "Último recurso: un título y unas pocas viñetas, sin nada dibujado. Casi siempre significa que no buscaste lo suficiente cómo dibujar la idea. Si lo eliges, que sea porque el contenido es una lista de verdad.",
    slots: {
      title: { x: 0.08, y: 0.1, w: 0.84, h: 0.14 },
      list: { x: 0.12, y: 0.3, w: 0.76, h: 0.55 },
      footer: { x: 0.08, y: 0.87, w: 0.84, h: 0.08 },
    },
    fallbackSlot: "list",
  },

  "visual-left-bullets-right": {
    id: "visual-left-bullets-right",
    label: "Visual e ideas",
    description:
      "El layout por defecto: un dibujo o diagrama a la izquierda y dos o tres ideas cortas a la derecha. Elígelo siempre que el concepto se pueda dibujar, que es casi siempre.",
    slots: {
      title: { x: 0.08, y: 0.08, w: 0.84, h: 0.13 },
      visual: { x: 0.07, y: 0.28, w: 0.36, h: 0.5 },
      list: { x: 0.5, y: 0.27, w: 0.44, h: 0.52 },
      footer: { x: 0.08, y: 0.85, w: 0.84, h: 0.08 },
    },
    fallbackSlot: "list",
  },

  "two-column-compare": {
    id: "two-column-compare",
    label: "Dos columnas",
    description:
      "Comparar dos cosas: antes/después, ventajas/desventajas, teoría A contra teoría B. Dibuja las dos, no las describas.",
    slots: {
      title: { x: 0.08, y: 0.08, w: 0.84, h: 0.13 },
      left: { x: 0.07, y: 0.26, w: 0.4, h: 0.58 },
      right: { x: 0.53, y: 0.26, w: 0.4, h: 0.58 },
    },
    fallbackSlot: "left",
  },

  "center-diagram-labels": {
    id: "center-diagram-labels",
    label: "Diagrama con etiquetas",
    description:
      "Un diagrama grande al centro con etiquetas alrededor. El otro que hay que preferir: para estructuras, ciclos, comparaciones, tablas y partes de algo. Si el dibujo es lo importante, va aquí.",
    slots: {
      title: { x: 0.08, y: 0.07, w: 0.84, h: 0.12 },
      center: { x: 0.22, y: 0.24, w: 0.54, h: 0.54 },
      aside: { x: 0.78, y: 0.26, w: 0.19, h: 0.5 },
      footer: { x: 0.08, y: 0.84, w: 0.84, h: 0.09 },
    },
    fallbackSlot: "center",
  },

  timeline: {
    id: "timeline",
    label: "Línea de tiempo",
    description:
      "Secuencias y procesos: fechas históricas, pasos de un método, etapas de un ciclo.",
    slots: {
      title: { x: 0.08, y: 0.09, w: 0.84, h: 0.13 },
      center: { x: 0.06, y: 0.33, w: 0.88, h: 0.36 },
      footer: { x: 0.08, y: 0.74, w: 0.84, h: 0.16 },
    },
    fallbackSlot: "center",
  },

  "formula-steps": {
    id: "formula-steps",
    label: "Fórmula y pasos",
    description:
      "Matemáticas, física y química: la fórmula arriba y su resolución paso a paso debajo.",
    slots: {
      title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
      center: { x: 0.12, y: 0.24, w: 0.76, h: 0.22 },
      list: { x: 0.14, y: 0.5, w: 0.72, h: 0.36 },
    },
    fallbackSlot: "center",
  },

  "summary-box": {
    id: "summary-box",
    label: "Resumen enmarcado",
    description:
      "El cierre: lo que hay que recordar, dentro de un recuadro dibujado a mano. Aun aquí, un dibujo se recuerda mejor que una frase.",
    slots: {
      title: { x: 0.08, y: 0.1, w: 0.84, h: 0.14 },
      list: { x: 0.16, y: 0.32, w: 0.68, h: 0.44 },
      footer: { x: 0.1, y: 0.82, w: 0.8, h: 0.1 },
    },
    fallbackSlot: "list",
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as SceneLayout[];

/**
 * Layout used when the model names one that does not exist.
 *
 * The fallback is a drawing layout on purpose: a scene that ends up here has
 * already gone wrong somewhere, and landing it on a slot that expects a picture
 * is a better failure than landing it on a list.
 */
export const DEFAULT_LAYOUT: SceneLayout = "visual-left-bullets-right";

export function isSceneLayout(value: unknown): value is SceneLayout {
  return typeof value === "string" && value in LAYOUTS;
}

export function slotsOf(layout: SceneLayout): Slot[] {
  return Object.keys(LAYOUTS[layout].slots) as Slot[];
}

export function hasSlot(layout: SceneLayout, slot: Slot): boolean {
  return slot in LAYOUTS[layout].slots;
}

/** Resolve a slot to a box, falling back to the layout's catch-all slot. */
export function resolveSlot(layout: SceneLayout, slot: Slot) {
  const definition = LAYOUTS[layout];
  return definition.slots[slot] ?? definition.slots[definition.fallbackSlot]!;
}

/**
 * How many bullets fit in a slot before the text gets too small to read.
 *
 * This is the physical limit. The editorial one — three per scene, whatever
 * fits — lives in `LIMITS.maxBulletsPerScene`, and is usually the tighter of
 * the two.
 */
export function bulletCapacity(layout: SceneLayout, slot: Slot): number {
  const box = resolveSlot(layout, slot);
  // One bullet needs roughly 9% of board height including its gap.
  return Math.max(2, Math.floor(box.h / 0.09));
}
