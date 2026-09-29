/**
 * Renders the last frame of every scene of every fixture to a PNG.
 *
 *   npm run engine:stills -- --out verification/fase1/before
 *   npm run engine:stills -- --out verification/fase1/after --only a,e
 *
 * This is verification, not export: it exists so a change to how the board
 * looks can be judged by looking at it, instead of by reading numbers and
 * hoping. It goes through `@remotion/renderer` and the real composition rather
 * than screenshotting the Player, because that is the same path an MP4 export
 * will take and a still drawn by a second implementation would prove nothing.
 *
 * The last frame of a scene is the one worth looking at: everything the scene
 * ever draws is on the board, so a piece of emphasis that swallows the title or
 * a label that floats away from its drawing is at its most visible.
 *
 * Fonts are handled in `remotion/hand-font.ts`, which holds every frame until
 * the handwriting face is really loaded and fails the render otherwise.
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { installDom } from "./engine-dom.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------- arguments -------------------------------- */

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const outDir = path.resolve(ROOT, flag("out") ?? "verification/fase1/before");
const only = flag("only")?.split(",").map((value) => value.trim()).filter(Boolean);
/** Which way lines are drawn: "rough" (the default) or "freehand". */
const strokeStyle = flag("stroke-style") ?? "rough";
/**
 * Suffix for the file name, so two stroke styles can sit side by side.
 * Defaults to the stroke style when it is not the usual one.
 */
const suffix = flag("suffix") ?? (strokeStyle === "rough" ? "" : `-${strokeStyle}`);

/* ------------------------- which frames to capture ------------------------- */

// The planner needs a DOM to measure with. Here it is only used to work out
// where each scene ends, which comes from `durationSeconds` and so is the same
// number the browser will arrive at.
installDom();

const { FASE1_FIXTURES, FASE1_IDS } = await import("@/fixtures/fase1");
const { buildTimeline } = await import("@/lib/engine/timeline");

type FixtureId = (typeof FASE1_IDS)[number];

const ids: FixtureId[] = only
  ? (only.filter((value): value is FixtureId => (FASE1_IDS as string[]).includes(value)))
  : [...FASE1_IDS];

if (ids.length === 0) {
  console.error("Ningún fixture coincide con --only.");
  process.exit(1);
}

interface Shot {
  name: string;
  storyboard: (typeof FASE1_FIXTURES)[FixtureId];
  frame: number;
}

const shots: Shot[] = [];
for (const id of ids) {
  const storyboard = FASE1_FIXTURES[id];
  const timeline = buildTimeline(storyboard);
  timeline.scenes.forEach((scene, index) => {
    shots.push({
      name:
        timeline.scenes.length > 1
          ? `${id}-escena-${index + 1}${suffix}`
          : `${id}${suffix}`,
      storyboard,
      // The last frame the scene owns: everything it draws is finished.
      frame: scene.from + scene.durationInFrames - 1,
    });
  });
}

/* --------------------------------- render --------------------------------- */

await mkdir(outDir, { recursive: true });

console.log(`Empaquetando la composición…`);
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "remotion/index.ts"),
  publicDir: path.join(ROOT, "public"),
  // Remotion builds this bundle with its own webpack, which knows nothing about
  // the `@/*` alias every engine module imports with.
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...config.resolve?.alias, "@": ROOT },
    },
  }),
  onProgress: (percent) => {
    if (percent === 100) console.log("  bundle listo");
  },
});

let failed = 0;
for (const shot of shots) {
  const inputProps = { storyboard: shot.storyboard, style: "classic-whiteboard", strokeStyle };
  const output = path.join(outDir, `${shot.name}.png`);

  try {
    const composition = await selectComposition({
      serveUrl,
      id: "whiteboard",
      inputProps,
    });

    if (existsSync(output)) await rm(output);

    await renderStill({
      composition,
      serveUrl,
      output,
      frame: Math.min(shot.frame, composition.durationInFrames - 1),
      inputProps,
      imageFormat: "png",
      // The font handle is the only thing holding a frame, and it is a network
      // fetch; a cold cache can take a while.
      timeoutInMilliseconds: 90_000,
      chromiumOptions: { gl: "angle" },
    });

    console.log(`  ✓ ${path.relative(ROOT, output)}  (frame ${shot.frame})`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${shot.name}: ${(error as Error).message}`);
  }
}

console.log(`\n${shots.length - failed}/${shots.length} stills en ${path.relative(ROOT, outDir)}`);
if (failed > 0) process.exit(1);
