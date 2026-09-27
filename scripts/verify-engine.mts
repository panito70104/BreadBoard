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

/* -------------------------------- report --------------------------------- */

console.log("frames recorridos:", totalFrames);
console.log("salto máximo de la mano:", maxJump.toFixed(1), "px/frame", maxJumpWhere);
console.log("salto máximo con el marcador apoyado:", maxInkJump.toFixed(1), "px/frame", maxInkJumpWhere);
console.log("frames con el marcador en el aire:", liftedFrames, `(${((liftedFrames / totalFrames) * 100).toFixed(1)}%)`);
console.log("zoom de la cámara:", minScale.toFixed(3), "a", maxScale.toFixed(3));
console.log("avisos del validador:", parsed.warnings.map((w) => w.code).join(", "));

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
