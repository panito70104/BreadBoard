/**
 * What one frame costs, per stroke style.
 *
 *   npm run engine:bench
 *
 * Task 4 adds real per-frame work: `"rough"` only changes a dash offset, while
 * `"freehand"` has to rebuild the outline of the stroke being drawn. This walks
 * every frame of every fixture doing exactly what the composition does at each
 * one — the stage, the camera, the visible steps, their slices, and (for
 * freehand) the outline of every visible stroke — and reports what it costs.
 *
 * The cache is what makes the difference bearable: only the active stroke is
 * ever recomputed, and the dozens already finished on the board are looked up.
 * The "sin caché" column is the same walk with the cache cleared every frame,
 * which is what the naive version of this would cost.
 */

import { installDom } from "./engine-dom.mjs";

installDom();

const { BOARD } = await import("@/lib/engine/board");
const { cameraAt } = await import("@/lib/engine/camera");
const { clearOutlineCache, freehandOutline } = await import("@/lib/engine/freehand");
const { endFrameOf, stageAt } = await import("@/lib/engine/hand-motion");
const { penProgress, penStateAt } = await import("@/lib/engine/pen");
const { planStoryboard, visibleSteps } = await import("@/lib/engine/plan");
const { FASE1_FIXTURES, FASE1_IDS } = await import("@/fixtures/fase1");

type ScenePlan = import("@/lib/engine/plan").ScenePlan;
type PlacedStep = import("@/lib/engine/plan").PlacedStep;
type StageState = import("@/lib/engine/hand-motion").StageState;

/** The same decision the composition makes, for the same reason. */
function slicesFor(placed: PlacedStep, stage: StageState, frame: number) {
  if (frame >= endFrameOf(placed, BOARD.fps)) return undefined;
  if (placed === stage.active) return stage.pen?.slices ?? undefined;
  return penStateAt(placed.pen, penProgress(frame, placed.timed, placed.pen, BOARD.fps)).slices;
}

interface Result {
  frames: number;
  ms: number;
  outlines: number;
  /**
   * The most expensive single frame.
   *
   * The average hides the thing worth knowing: in most frames no stroke is
   * being drawn at all — the pen finishes ahead of its slot and the hand waits
   * — so the cost that matters is the one in a frame that is actually drawing.
   */
  worstMs: number;
}

function walk(plans: ScenePlan[], freehand: boolean, coldCache: boolean): Result {
  let frames = 0;
  let outlines = 0;
  let worstMs = 0;
  const started = performance.now();

  for (const plan of plans) {
    const { from, durationInFrames } = plan.scene;
    for (let frame = from; frame < from + durationInFrames; frame += 1) {
      frames += 1;
      if (coldCache) clearOutlineCache();
      const frameStarted = performance.now();

      const stage = stageAt(frame, plan, BOARD.fps);
      cameraAt(plan.camera, frame, BOARD.fps);

      for (const placed of visibleSteps(plan, frame)) {
        const slices = slicesFor(placed, stage, frame);
        if (!freehand) continue;

        placed.parts.forEach((part, index) => {
          if (part.kind !== "strokes") return;
          const share = slices?.[index];
          part.paths.forEach((d, pathIndex) => {
            const value = share?.[pathIndex] ?? 1;
            if (value <= 0) return;
            outlines += 1;
            freehandOutline(d, value, {
              width: part.strokeWidth,
              unitScale: part.frame.w / (part.viewBox.w || 1),
              seconds: placed.pen.strokeSeconds[index]?.[pathIndex] ?? 0.2,
            });
          });
        });
      }

      worstMs = Math.max(worstMs, performance.now() - frameStarted);
    }
  }

  return { frames, ms: performance.now() - started, outlines, worstMs };
}

/* --------------------------------- run ----------------------------------- */

const plans = FASE1_IDS.flatMap((id) => planStoryboard(FASE1_FIXTURES[id]).plans);

// Everything is cached on first touch — paths, samples, layouts. Warm it up so
// the numbers are about drawing frames and not about planning them.
walk(plans, true, false);
clearOutlineCache();

const rows: [string, Result][] = [
  ["rough", walk(plans, false, false)],
  ["freehand", walk(plans, true, false)],
  ["freehand sin caché", walk(plans, true, true)],
];

console.log(`fixtures: ${FASE1_IDS.join(", ")}`);
console.log(`frames por pasada: ${rows[0][1].frames}\n`);
console.log("estilo                  ms/frame   peor frame   % de 33.3ms   contornos");
for (const [name, result] of rows) {
  const perFrame = result.ms / result.frames;
  console.log(
    `${name.padEnd(22)} ${perFrame.toFixed(3).padStart(8)}   ` +
      `${result.worstMs.toFixed(3).padStart(10)}   ` +
      `${((result.worstMs / (1000 / BOARD.fps)) * 100).toFixed(1).padStart(11)}%   ` +
      `${String(result.outlines).padStart(9)}`,
  );
}

const rough = rows[0][1].ms / rows[0][1].frames;
const freehand = rows[1][1].ms / rows[1][1].frames;
console.log(
  `\nfreehand cuesta ${(freehand - rough).toFixed(3)} ms/frame de media y ` +
    `${(rows[1][1].worstMs - rows[0][1].worstMs).toFixed(3)} ms en su peor frame.`,
);
