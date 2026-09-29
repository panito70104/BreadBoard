/**
 * Runs the whole engine headlessly and checks the invariants that matter.
 *
 *   npm run engine:verify
 *
 * There is no browser here, so `engine-dom.mts` stands in for the two pieces of
 * the DOM the engine measures with: SVG path lengths and canvas text metrics.
 * Its geometry is approximate, which is fine — everything asserted below holds
 * whatever the geometry is:
 *
 * - with the marker on the board the tip never jumps, because the ink follows
 *   it and a jump is a skipped stroke;
 * - in the air it may move fast, but not so fast it becomes a smear;
 * - ink only ever grows, and every step is finished by its last frame;
 * - the camera never shows past the edge of the board;
 * - and the validator caps a scene that is all writing.
 */
import { installDom } from "./engine-dom.mjs";

installDom();

const { BOARD } = await import("@/lib/engine/board");
const { planStoryboard } = await import("@/lib/engine/plan");
const { stageAt, endFrameOf } = await import("@/lib/engine/hand-motion");
const { cameraAt } = await import("@/lib/engine/camera");
const { parseStoryboard } = await import("@/lib/storyboard/schema");
type Storyboard = import("@/types/storyboard").Storyboard;
type StoryboardScene = import("@/types/storyboard").StoryboardScene;
type StoryboardStep = import("@/types/storyboard").StoryboardStep;

const fail: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) fail.push(message);
};

/* ----------------------------- the storyboard ----------------------------- */

const scene = (
  index: number,
  layout: StoryboardScene["layout"],
  narration: string,
  steps: StoryboardStep[],
  durationSeconds = 24,
): StoryboardScene => ({
  id: `s${index}`,
  index,
  title: `Escena ${index}`,
  summary: "",
  narration,
  layout,
  steps,
  durationSeconds,
});

/**
 * A scene with a voice-over: every step knows the second its phrase is spoken.
 *
 * This is the case the whole engine exists to serve, and the one where being
 * wrong is loudest — a drawing that lands after the narrator has moved on.
 */
const voicedScene = (index: number, at: number[]): StoryboardScene => ({
  id: `v${index}`,
  index,
  title: `Con voz ${index}`,
  summary: "",
  narration: "Primero una cosa, después otra cosa, y al final la última de todas.",
  layout: "visual-left-bullets-right",
  durationSeconds: 26,
  audio: { key: "x", durationSeconds: 25.2, voiceId: "v" },
  steps: at.map((seconds, i) => ({
    on: null,
    at: seconds,
    draw:
      i === 0
        ? { type: "title", text: "Con voz" }
        : i % 2 === 1
          ? {
              type: "sketch",
              slot: "visual",
              items: [{ icon: "Coins" }, { icon: "ShoppingCart" }],
              relation: "arrow",
            }
          : { type: "bullet", slot: "list", text: `Punto ${i}`, marker: "dot" },
  })),
});

const storyboard: Storyboard = {
  videoTitle: "Prueba",
  language: "es",
  targetSeconds: 120,
  totalSeconds: 0,
  scenes: [
    scene(1, "visual-left-bullets-right", "Primero esto y luego lo otro y al final el cierre.", [
      { on: "Primero esto", draw: { type: "title", text: "Qué es la inflación" } },
      { on: "Primero esto", draw: { type: "emphasis", shape: "underline", target: "prev" } },
      {
        on: "luego lo otro",
        draw: {
          type: "sketch",
          slot: "visual",
          items: [
            { icon: "Coins", label: "100" },
            { icon: "ShoppingCart", label: "1 pan", mark: "cross" },
          ],
          relation: "equals",
          caption: "el dinero vale menos",
        },
      },
      { on: "luego lo otro", draw: { type: "bullet", slot: "list", text: "Los precios suben", marker: "arrow" } },
      { on: "al final el cierre", draw: { type: "bullet", slot: "list", text: "Tu dinero compra menos", marker: "dot" } },
      { on: "al final el cierre", draw: { type: "emphasis", shape: "box", target: "list" } },
    ]),
    scene(2, "center-diagram-labels", "Miramos las barras y después la tabla completa.", [
      { on: "Miramos las barras", draw: { type: "title", text: "Comparando" } },
      {
        on: "Miramos las barras",
        draw: { type: "diagram", slot: "center", kind: "bars", labels: ["2020", "2021", "2022"], values: [2, 5, 9] },
      },
      { on: "después la tabla", draw: { type: "text", slot: "aside", text: "Sube cada año", size: "sm" } },
      { on: "después la tabla", draw: { type: "erase", scope: "board" } },
      {
        on: "la tabla completa",
        draw: {
          type: "diagram",
          slot: "center",
          kind: "table",
          columns: 3,
          labels: ["Año", "Precio", "Sueldo", "2020", "10", "100", "2022", "20", "110"],
        },
      },
    ], 34),
    scene(3, "two-column-compare", "A la izquierda lo viejo y a la derecha lo nuevo.", [
      { on: "A la izquierda", draw: { type: "title", text: "Antes y después" } },
      {
        on: "A la izquierda",
        draw: { type: "sketch", slot: "left", items: [{ icon: "Factory" }, { icon: "CloudRain", label: "humo" }], relation: "arrow" },
      },
      {
        on: "a la derecha lo nuevo",
        draw: { type: "sketch", slot: "right", items: [{ icon: "Sun" }, { icon: "Sprout", label: "limpio", mark: "check" }], relation: "arrow" },
      },
      { on: "a la derecha lo nuevo", draw: { type: "formula", slot: "left", text: "C = 2 x N" } },
    ]),
    voicedScene(5, [0, 3.4, 9.1, 14.6, 20.3]),
    scene(4, "timeline", "Una línea de tiempo con tres momentos y un icono al final.", [
      { on: "Una línea de tiempo", draw: { type: "title", text: "La historia" } },
      { on: "tres momentos", draw: { type: "diagram", slot: "center", kind: "timeline", labels: ["1900", "1950", "2000"] } },
      { on: "un icono al final", draw: { type: "icon", slot: "footer", id: "Rocket" } },
    ]),
  ],
};
storyboard.totalSeconds = storyboard.scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

/* ------------------------------- the walk -------------------------------- */

const { timeline, plans } = planStoryboard(storyboard);

let maxJump = 0;
let maxJumpWhere = "";
let maxInkJump = 0;
let maxInkJumpWhere = "";
let liftedFrames = 0;
let totalFrames = 0;
let minScale = Infinity;
let maxScale = 0;

timeline.scenes.forEach((timed, sceneIndex) => {
  const plan = plans[sceneIndex];

  for (const step of plan.steps) {
    if (step.parts.length === 0) continue;
    check(
      step.pen.seconds > 0,
      `escena ${sceneIndex + 1} paso ${step.timed.index}: el plan del lápiz dura 0s`,
    );
    check(
      step.pen.sliceCounts.length === step.parts.length,
      `escena ${sceneIndex + 1} paso ${step.timed.index}: cuotas y partes no coinciden`,
    );
  }

  let previous: { x: number; y: number } | null = null;
  const seen = new Map<string, number>();

  for (let frame = timed.from; frame < timed.from + timed.durationInFrames; frame += 1) {
    totalFrames += 1;
    const stage = stageAt(frame, plan, BOARD.fps);
    const camera = cameraAt(plan.camera, frame, BOARD.fps);

    minScale = Math.min(minScale, camera.scale);
    maxScale = Math.max(maxScale, camera.scale);
    check(camera.scale >= 1, `escena ${sceneIndex + 1} f${frame}: la cámara se alejó de la pizarra`);
    check(
      camera.x <= 0.01 && camera.x >= BOARD.width * (1 - camera.scale) - 0.01,
      `escena ${sceneIndex + 1} f${frame}: la cámara se salió por el borde horizontal`,
    );
    check(
      camera.y <= 0.01 && camera.y >= BOARD.height * (1 - camera.scale) - 0.01,
      `escena ${sceneIndex + 1} f${frame}: la cámara se salió por el borde vertical`,
    );

    if (stage.hand) {
      if (previous) {
        const jump = Math.hypot(stage.hand.x - previous.x, stage.hand.y - previous.y);
        if (jump > maxJump) {
          maxJump = jump;
          maxJumpWhere = `escena ${sceneIndex + 1} f${frame}`;
        }
        // With the tip on the board the ink follows the hand, so any jump at
        // all is a skipped stroke. In the air it is only ever a fast reach.
        const inking = stage.hand.lift < 0.02 && stage.hand.tool === "marker";
        if (inking && jump > maxInkJump) {
          maxInkJump = jump;
          maxInkJumpWhere = `escena ${sceneIndex + 1} f${frame} (${stage.active?.element.type ?? "entre pasos"})`;
        }
      }
      previous = { x: stage.hand.x, y: stage.hand.y };
      if (stage.hand.lift > 0.02) liftedFrames += 1;
    } else {
      previous = null;
    }

    if (stage.active && stage.pen) {
      stage.pen.slices.forEach((part, partIndex) => {
        part.forEach((value, sliceIndex) => {
          const key = `${stage.active!.timed.index}:${partIndex}:${sliceIndex}`;
          const last = seen.get(key) ?? 0;
          check(
            value >= last - 1e-6,
            `escena ${sceneIndex + 1} f${frame}: la tinta retrocedió en ${key} (${last.toFixed(3)} -> ${value.toFixed(3)})`,
          );
          seen.set(key, Math.max(last, value));
        });
      });
    }
  }

  // Everything that was drawn has to be finished by the time the step ends.
  for (const step of plan.steps) {
    if (step.parts.length === 0) continue;
    const last = endFrameOf(step, BOARD.fps) - 1;
    const stage = stageAt(last, plan, BOARD.fps);
    if (!stage.pen) continue;
    const unfinished = stage.pen.slices.flat().filter((value) => value < 0.999).length;
    check(
      unfinished === 0,
      `escena ${sceneIndex + 1} paso ${step.timed.index}: ${unfinished} trazos sin terminar en su último frame`,
    );
  }
});

/* --------------------------- the voice's own clock ------------------------ */

// A step that declares the second it is spoken has to be drawn at that second.
// Everything else in a scene bends around it: the drawing before gets less
// time, the reach between them takes what is left. Nothing may push a cue late.
for (const timed of timeline.scenes) {
  for (const step of timed.steps) {
    const at = step.step.at;
    if (at === undefined) continue;
    const landed = (step.from - timed.from) / BOARD.fps;
    check(
      Math.abs(landed - at) < 1 / BOARD.fps + 1e-6,
      `escena ${timed.scene.index} paso ${step.index}: la voz lo dice en ${at}s y se dibuja en ${landed.toFixed(2)}s`,
    );
  }
}

/* ------------------------------ the validator ----------------------------- */

const raw = {
  videoTitle: "Muro de texto",
  scenes: [
    {
      title: "Todo escrito",
      narration: "uno dos tres cuatro cinco seis",
      layout: "title-bullets",
      durationSeconds: 20,
      steps: [
        { on: "uno", draw: { type: "title", text: "Todo escrito" } },
        { on: "uno", draw: { type: "bullet", slot: "list", text: "Primera" } },
        { on: "dos", draw: { type: "bullet", slot: "list", text: "Segunda" } },
        { on: "tres", draw: { type: "bullet", slot: "list", text: "Tercera" } },
        { on: "cuatro", draw: { type: "bullet", slot: "list", text: "Cuarta" } },
        { on: "cinco", draw: { type: "bullet", slot: "list", text: "Quinta" } },
      ],
    },
    {
      title: "Con dibujos",
      narration: "aqui si dibujamos algo de verdad",
      layout: "visual-left-bullets-right",
      durationSeconds: 20,
      steps: [
        { on: "aqui si", draw: { type: "sketch", slot: "visual", items: [{ icon: "Factory" }, { icon: "Cloud" }], relation: "arrow" } },
        { on: "dibujamos algo", draw: { type: "sketch", slot: "list", items: [{ icon: "NoExisteEsteIcono" }, { icon: "Sun" }] } },
        { on: "de verdad", draw: { type: "diagram", slot: "list", kind: "table", columns: 2, labels: ["A", "B", "1", "2"] } },
      ],
    },
  ],
};

const parsed = parseStoryboard(raw);
const first = parsed.storyboard.scenes[0];
const second = parsed.storyboard.scenes[1];
const bullets = first.steps.filter((s) => s.draw.type === "bullet").length;

check(bullets === 3, `el tope de viñetas no se aplicó: quedaron ${bullets}`);
check(
  parsed.warnings.some((w) => w.code === "text-heavy"),
  "no avisó de que la escena solo escribe",
);
check(
  second.steps.some((s) => s.draw.type === "sketch"),
  "el sketch válido no sobrevivió",
);
check(
  second.steps.some((s) => s.draw.type === "icon"),
  "el sketch de una sola pieza no se convirtió en icono",
);
check(
  parsed.warnings.some((w) => w.code === "sketch-repaired"),
  "no avisó de haber reparado el sketch",
);
const table = second.steps.find(
  (s) => s.draw.type === "diagram" && s.draw.kind === "table",
);
check(Boolean(table), "la tabla no sobrevivió al validador");

/* ----------------------------- how it looks ------------------------------- */

/*
 * The checks above are mechanical: nothing jumps, nothing goes backwards, the
 * camera stays on the board. They all passed while the board was producing
 * ellipses that swallowed the title and ticks drawn straight through the
 * drawing they were approving, because none of them ever asked where the ink
 * actually is.
 *
 * These do. Every number here is measured off the real geometry — the sampled
 * paths the hand will trace and the laid-out rows the text really occupies —
 * and run over `fixtures/fase1.ts`, which is the set of frames that made the
 * work necessary, plus the storyboard above.
 */

const { FASE1_FIXTURES, FASE1_IDS } = await import("@/fixtures/fase1");
const { partsBounds, boxesOverlap, boxArea } = await import("@/lib/engine/ink-bounds");
type Box = import("@/lib/engine/board").Box;
type Part = import("@/lib/engine/parts").Part;
type ScenePlan = import("@/lib/engine/plan").ScenePlan;

const BOARD_AREA = BOARD.width * BOARD.height;

interface Looks {
  /** Emphasis whose ink leaves the board. */
  offBoard: number;
  /**
   * Emphasis the camera cuts off at the frame it finishes on.
   *
   * A shape can sit inside the board and still be sliced in half on screen:
   * the camera frames the ink it is told about, and an emphasis reports its
   * *target* as its bounds rather than the shape it actually draws. So the
   * planner asks the camera to look at a title and then draws an ellipse twice
   * its size around it.
   */
  cropped: number;
  /** Emphasis crossing the title's ink when the title is not its target. */
  overTitle: number;
  /** Emphasis crossing ink that belongs to something else. */
  overOther: number;
  /** The largest share of the board a single emphasis covers. */
  maxShare: number;
  /** The furthest a label or caption sits from the ink it belongs to. */
  maxLabelGap: number;
  maxLabelGapWhere: string;
  /** The smallest type size that actually gets drawn. */
  minText: number;
  minTextWhere: string;
  /** Emphasis the planner had to shrink, downgrade or drop. */
  degraded: string[];
}

const looks: Looks = {
  offBoard: 0,
  cropped: 0,
  overTitle: 0,
  overOther: 0,
  maxShare: 0,
  maxLabelGap: 0,
  maxLabelGapWhere: "",
  minText: Infinity,
  minTextWhere: "",
  degraded: [],
};

/** The vertical gap between a text part and the nearest ink above it. */
function gapAbove(text: Part, others: Part[]): number | null {
  if (text.kind !== "text") return null;
  const box = partsBounds([text]);
  if (!box) return null;

  let nearest: number | null = null;
  for (const other of others) {
    if (other === text) continue;
    // Anything already on the board counts as what this text hangs off, ink or
    // writing: a caption belongs under the labels, not under the pictures.
    const ink = partsBounds([other]);
    if (!ink) continue;
    // Everything this text sits below, wherever it sits horizontally. A caption
    // centred under a row of labels rarely lines up with any single one of
    // them, and demanding that it does measures the distance to the pictures
    // instead of to the labels it actually hangs off.
    if (ink.y + ink.h > box.y) continue;
    const gap = box.y - (ink.y + ink.h);
    if (nearest === null || gap < nearest) nearest = gap;
  }
  return nearest;
}

function inspect(label: string, plans: ScenePlan[]) {
  for (const plan of plans) {
    for (const warning of plan.warnings ?? []) {
      looks.degraded.push(`${label}: ${warning}`);
    }

    // Ink each step leaves, and which slot owns it.
    const inked = plan.steps
      .map((step) => ({ step, box: partsBounds(step.parts) }))
      .filter((entry): entry is { step: (typeof plan.steps)[number]; box: Box } =>
        Boolean(entry.box),
      );

    for (const step of plan.steps) {
      // ---- text size, anywhere it is drawn
      for (const part of step.parts) {
        if (part.kind !== "text") continue;
        if (part.fontSize < looks.minText) {
          looks.minText = part.fontSize;
          looks.minTextWhere = `${label} "${part.text.slice(0, 24)}"`;
        }
      }

      // ---- how far a label floats from its drawing
      //
      // Sketches only. A diagram's labels sit against geometry the diagram
      // decided — a table's cell text belongs in its cell and a bar chart's
      // names belong on the axis — so "distance to the nearest ink above" says
      // nothing useful about them.
      if (step.element.type === "sketch") {
        for (const part of step.parts) {
          const gap = gapAbove(part, step.parts);
          if (gap !== null && gap > looks.maxLabelGap) {
            looks.maxLabelGap = gap;
            looks.maxLabelGapWhere = `${label} ${step.element.type} "${
              part.kind === "text" ? part.text.slice(0, 20) : ""
            }"`;
          }
        }
      }

      if (step.element.type !== "emphasis") continue;

      const box = partsBounds(step.parts);
      if (!box) continue;

      // ---- does it stay on the board?
      if (box.x < 0 || box.y < 0 || box.x + box.w > BOARD.width || box.y + box.h > BOARD.height) {
        looks.offBoard += 1;
        fail.push(
          `${label}: un énfasis "${step.element.shape}" se sale del tablero ` +
            `(x ${box.x.toFixed(0)}..${(box.x + box.w).toFixed(0)}, ` +
            `y ${box.y.toFixed(0)}..${(box.y + box.h).toFixed(0)})`,
        );
      }

      // ---- how much of the board does it claim?
      looks.maxShare = Math.max(looks.maxShare, boxArea(box) / BOARD_AREA);

      // ---- is any of it still on screen once the camera has moved?
      const frame = endFrameOf(step, BOARD.fps) - 1;
      const shot = cameraAt(plan.camera, frame, BOARD.fps);
      const visible: Box = {
        x: -shot.x / shot.scale,
        y: -shot.y / shot.scale,
        w: BOARD.width / shot.scale,
        h: BOARD.height / shot.scale,
      };
      if (
        box.x < visible.x - 1 ||
        box.y < visible.y - 1 ||
        box.x + box.w > visible.x + visible.w + 1 ||
        box.y + box.h > visible.y + visible.h + 1
      ) {
        looks.cropped += 1;
        fail.push(
          `${label}: la cámara recorta un énfasis "${step.element.shape}" en f${frame}`,
        );
      }

      // ---- does it cross anything that is not its target?
      const target = step.element.target;
      for (const other of inked) {
        if (other.step === step) continue;
        if (other.step.element.type === "emphasis") continue;

        const ownedByTarget =
          target === "prev"
            ? other.step.timed.index === step.timed.index - 1
            : "slot" in other.step.element
              ? other.step.element.slot === target
              : other.step.element.type === "title" && target === "title";

        if (ownedByTarget) continue;
        // A stroke crossing a couple of pixels of a neighbour is not a defect;
        // a shape drawn through it is.
        if (!boxesOverlap(box, other.box, 6)) continue;

        if (other.step.element.type === "title") {
          looks.overTitle += 1;
          fail.push(`${label}: un énfasis "${step.element.shape}" cruza el título`);
        } else {
          looks.overOther += 1;
          fail.push(
            `${label}: un énfasis "${step.element.shape}" cruza la tinta de ` +
              `${other.step.element.type}`,
          );
        }
      }
    }
  }
}

inspect("prueba", plans);
for (const id of FASE1_IDS) {
  inspect(`fixture ${id.toUpperCase()}`, planStoryboard(FASE1_FIXTURES[id]).plans);
}

/* --------------------------- the freehand stroke -------------------------- */

/*
 * Invariant 4, for the one thing in the engine that now builds geometry per
 * frame instead of once per scene.
 *
 * Remotion renders frames in parallel and out of order, so a stroke outline has
 * to be a function of the frame and nothing else — not of the frame before it,
 * and not of whether the cache happens to be warm. This walks a scene's frames
 * backwards and compares every outline against the same frame computed on a
 * cold cache.
 */
const { clearOutlineCache, freehandOutline } = await import("@/lib/engine/freehand");
const { penProgress: penProgressOf, penStateAt: penStateOf } = await import("@/lib/engine/pen");
const { visibleSteps } = await import("@/lib/engine/plan");

let outlinesChecked = 0;

{
  const plan = planStoryboard(FASE1_FIXTURES.c).plans[0];
  const { from, durationInFrames } = plan.scene;

  const outlinesAt = (frame: number) => {
    const stage = stageAt(frame, plan, BOARD.fps);
    const drawn: string[] = [];
    for (const placed of visibleSteps(plan, frame)) {
      const slices =
        frame >= endFrameOf(placed, BOARD.fps)
          ? undefined
          : placed === stage.active
            ? stage.pen?.slices
            : penStateOf(
                placed.pen,
                penProgressOf(frame, placed.timed, placed.pen, BOARD.fps),
              ).slices;
      placed.parts.forEach((part, index) => {
        if (part.kind !== "strokes") return;
        part.paths.forEach((d, pathIndex) => {
          const share = slices?.[index]?.[pathIndex] ?? 1;
          if (share <= 0) return;
          drawn.push(
            freehandOutline(d, share, {
              width: part.strokeWidth,
              unitScale: part.frame.w / (part.viewBox.w || 1),
              seconds: placed.pen.strokeSeconds[index]?.[pathIndex] ?? 0.2,
            }),
          );
        });
      });
    }
    return drawn;
  };

  // Backwards, on a cache warmed by nothing in particular.
  const reverse = new Map<number, string[]>();
  for (let frame = from + durationInFrames - 1; frame >= from; frame -= 4) {
    reverse.set(frame, outlinesAt(frame));
  }

  for (const [frame, expected] of reverse) {
    clearOutlineCache();
    const fresh = outlinesAt(frame);
    outlinesChecked += fresh.length;
    check(
      fresh.length === expected.length && fresh.every((d, i) => d === expected[i]),
      `f${frame}: el trazo freehand no es función pura del frame`,
    );
  }
}

// The x-height of the handwriting face, measured — see `lib/engine/text.ts`.
const X_RATIO = 0.357;

/* -------------------------------- report --------------------------------- */

console.log("frames recorridos:", totalFrames);
console.log("salto máximo de la mano:", maxJump.toFixed(1), "px/frame", maxJumpWhere);
console.log("salto máximo con el marcador apoyado:", maxInkJump.toFixed(1), "px/frame", maxInkJumpWhere);
console.log("frames con el marcador en el aire:", liftedFrames, `(${((liftedFrames / totalFrames) * 100).toFixed(1)}%)`);
console.log("zoom de la cámara:", minScale.toFixed(3), "a", maxScale.toFixed(3));
console.log("avisos del validador:", parsed.warnings.map((w) => w.code).join(", "));

console.log("\ncómo se ve:");
console.log("  énfasis fuera del tablero:", looks.offBoard);
console.log("  énfasis recortados por la cámara:", looks.cropped);
console.log("  énfasis que cruzan el título:", looks.overTitle);
console.log("  énfasis que cruzan otra tinta:", looks.overOther);
console.log("  mayor área de un énfasis:", `${(looks.maxShare * 100).toFixed(1)}% del tablero`);
console.log(
  "  etiqueta más lejos de su tinta:",
  `${looks.maxLabelGap.toFixed(0)}px`,
  looks.maxLabelGapWhere,
);
console.log(
  "  texto más pequeño dibujado:",
  `${looks.minText.toFixed(0)}px de cuerpo`,
  `(~${(looks.minText * X_RATIO).toFixed(0)}px de altura de x)`,
  looks.minTextWhere,
);
console.log("  contornos freehand comprobados como puros:", outlinesChecked);
console.log("  degradaciones de énfasis:", looks.degraded.length);
for (const note of looks.degraded) console.log("   ·", note);

// A stroke is drawn at DRAW_SPEED (1150 px/s) and eased, so it peaks around
// 1.5x that: ~58px per frame at 30fps, plus a little for the rough wobble.
// Anything past that is the pen skipping, not the pen drawing.
check(maxInkJump < 75, `la tinta salta ${maxInkJump.toFixed(0)}px con el marcador apoyado en ${maxInkJumpWhere}`);
check(maxJump < 260, `la mano se mueve a ${maxJump.toFixed(0)}px/frame en ${maxJumpWhere}, que ya es un borrón`);
check(liftedFrames > 0, "el marcador nunca se levanta de la pizarra");

if (fail.length) {
  console.log("\nFALLOS:");
  for (const message of fail) console.log(" -", message);
  process.exit(1);
}
console.log("\nTodo en orden.");
