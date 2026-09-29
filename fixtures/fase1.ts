/**
 * The frames that made phase 1 necessary.
 *
 * Each of these is a real failure seen in a rendered frame, reduced to the
 * smallest storyboard that still reproduces it. They are the input to both
 * `npm run engine:verify` (numbers) and `npm run engine:stills` (pictures), so
 * a fix is never declared on one alone.
 *
 * Every scene is silent on purpose: `at` would pin the drawing to a measured
 * second, and none of what is being fixed here is about timing. Without a voice
 * the engine spaces the steps by where their phrase sits in the narration,
 * which is enough to reach the last frame with everything drawn.
 */

import type { Storyboard, StoryboardScene } from "@/types/storyboard";

function board(id: string, title: string, scene: Omit<StoryboardScene, "id" | "index">): Storyboard {
  return {
    videoTitle: title,
    language: "es",
    targetSeconds: scene.durationSeconds,
    totalSeconds: scene.durationSeconds,
    scenes: [{ id, index: 1, ...scene }],
  };
}

/**
 * A — the emphasis that swallows the board.
 *
 * Four pieces with arrows, a small line of text under them, and a circle over
 * the slot. The circle is sized to the slot, so it clears the drawing by a
 * couple of hundred pixels on every side, crosses the title and runs off the
 * bottom edge.
 */
export const FIXTURE_A = board("fase1-a", "A · énfasis sobre sketch de 4 piezas", {
  title: "Cadena de suministro",
  summary: "",
  narration:
    "La cadena empieza en la fábrica, pasa por el camión y la tienda, y termina en tus manos. Todo el recorrido encarece el producto.",
  layout: "center-diagram-labels",
  durationSeconds: 26,
  steps: [
    { on: "La cadena empieza", draw: { type: "title", text: "Cadena de suministro" } },
    {
      on: "pasa por el camión",
      draw: {
        type: "sketch",
        slot: "center",
        items: [
          { icon: "Factory", label: "fábrica" },
          { icon: "Truck", label: "transporte" },
          { icon: "Store", label: "tienda" },
          { icon: "ShoppingCart", label: "cliente" },
        ],
        relation: "arrow",
        caption: "cada paso suma coste",
      },
    },
    {
      on: "termina en tus manos",
      draw: { type: "text", slot: "center", text: "cuatro eslabones, cuatro márgenes", size: "sm" },
    },
    { on: "Todo el recorrido encarece", draw: { type: "emphasis", shape: "circle", target: "center" } },
  ],
});

/**
 * B — the emphasis that runs off the right edge.
 *
 * Two columns, a `vs` sketch on the right, a circle over that slot. The slot
 * already reaches to within 7% of the board's right edge; an ellipse drawn 20%
 * wider than it, plus the Rough.js bowing on a 470px radius, does not fit.
 */
export const FIXTURE_B = board("fase1-b", "B · énfasis en columna derecha", {
  title: "Alquilar o comprar",
  summary: "",
  narration:
    "A la izquierda, alquilar: pagas y te vas. A la derecha, comprar: pagas mucho más pero es tuyo. Comprar gana a largo plazo.",
  layout: "two-column-compare",
  durationSeconds: 24,
  steps: [
    { on: "A la izquierda", draw: { type: "title", text: "Alquilar o comprar" } },
    {
      on: "pagas y te vas",
      draw: {
        type: "sketch",
        slot: "left",
        items: [{ icon: "Key", label: "alquilar" }, { icon: "Coins", label: "cuota" }],
        relation: "arrow",
      },
    },
    {
      on: "A la derecha, comprar",
      draw: {
        type: "sketch",
        slot: "right",
        items: [{ icon: "House", label: "comprar" }, { icon: "Landmark", label: "hipoteca" }],
        relation: "vs",
        caption: "más caro al principio",
      },
    },
    { on: "Comprar gana a largo plazo", draw: { type: "emphasis", shape: "circle", target: "right" } },
  ],
});

/**
 * C — the tick that reads as a scribble.
 *
 * `check` is drawn from 46% to 102% of the frame width and from 88% to 30% of
 * its height: a stroke straight across the middle of the picture it is meant
 * to approve.
 */
export const FIXTURE_C = board("fase1-c", "C · marca check sobre la pieza", {
  title: "Energía limpia",
  summary: "",
  narration:
    "La central de carbón contamina. El panel solar no, y por eso es la opción correcta para el futuro.",
  layout: "visual-left-bullets-right",
  durationSeconds: 22,
  steps: [
    { on: "La central de carbón", draw: { type: "title", text: "Energía limpia" } },
    {
      on: "El panel solar no",
      draw: {
        type: "sketch",
        slot: "visual",
        items: [
          { icon: "Factory", label: "carbón", mark: "cross" },
          { icon: "Sun", label: "solar", mark: "check" },
        ],
        relation: "arrow",
        caption: "cambiamos la fuente",
      },
    },
    { on: "la opción correcta", draw: { type: "bullet", slot: "list", text: "Sin humo", marker: "check" } },
    { on: "para el futuro", draw: { type: "bullet", slot: "list", text: "Cuesta menos cada año", marker: "dot" } },
  ],
});

/**
 * D — the underline that does not match the words.
 *
 * The title wraps to two lines. The underline is drawn under the block at the
 * width of the *widest* line, so on the second line it starts before the text
 * and ends somewhere else entirely.
 */
export const FIXTURE_D = board("fase1-d", "D · subrayado de título", {
  title: "La inflación se come tus ahorros mientras duermes",
  summary: "",
  narration:
    "La inflación se come tus ahorros sin que lo notes. Es el impuesto que nadie vota.",
  layout: "title-only",
  durationSeconds: 18,
  steps: [
    {
      on: "La inflación se come",
      draw: { type: "title", text: "La inflación se come tus ahorros mientras duermes" },
    },
    { on: "sin que lo notes", draw: { type: "emphasis", shape: "underline", target: "prev" } },
    { on: "el impuesto que nadie vota", draw: { type: "text", slot: "footer", text: "el impuesto que nadie vota", size: "sm" } },
  ],
});

/**
 * E — the link that Rough.js dents.
 *
 * One piece, so it gets the whole slot: a 24-unit icon blown up to ~583px, a
 * scale of 24x. The roughness is specified in icon units and multiplied by
 * that same 24, so the two arcs of the link get about 12px of board-space
 * noise and stop reading as circles.
 */
export const FIXTURE_E = board("fase1-e", "E · eslabón a tamaño grande", {
  title: "Todo está conectado",
  summary: "",
  narration: "Cada parte del sistema está conectada con la siguiente. Rompe un eslabón y se cae todo.",
  layout: "center-diagram-labels",
  durationSeconds: 18,
  steps: [
    { on: "Cada parte del sistema", draw: { type: "title", text: "Todo está conectado" } },
    {
      on: "Rompe un eslabón",
      draw: { type: "sketch", slot: "center", items: [{ icon: "Link" }], relation: "none" },
    },
  ],
});

export const FASE1_FIXTURES = {
  a: FIXTURE_A,
  b: FIXTURE_B,
  c: FIXTURE_C,
  d: FIXTURE_D,
  e: FIXTURE_E,
} as const;

export type Fase1FixtureId = keyof typeof FASE1_FIXTURES;

export const FASE1_IDS = Object.keys(FASE1_FIXTURES) as Fase1FixtureId[];
