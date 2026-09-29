/**
 * Runs the storyboard half of the pipeline against a text file, with no
 * database, no storage and no voice.
 *
 *   npm run engine:generate -- --doc fixtures/fase2/linked-list.txt \
 *                              --out verification/fase2/before
 *
 * Phase 2 is about what gets drawn, and everything that decides that happens
 * before the first byte of audio. Leaving the voice out keeps a run to one
 * Claude call (or two, when `visualHealth` asks again) and means a fixture can
 * be regenerated as often as a prompt change needs without paying ElevenLabs
 * for narration nobody will hear.
 *
 * Writes, per document: the storyboard JSON the renderer reads, the visual plan
 * when there is one, and a readable summary. The token ledger goes to stdout.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { installDom } from "./engine-dom.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The planner measures text with a canvas and paths with SVG; the storyboard
// half does not need either, but `fitToDuration` and the summary below walk the
// same modules, so the stand-in DOM goes in before anything imports them.
installDom();

const { generateStoryboard } = await import("@/lib/storyboard/generate");
const { fitToDuration } = await import("@/lib/storyboard/fit");
const { UsageLedger } = await import("@/lib/storyboard/usage");

type Storyboard = import("@/types/storyboard").Storyboard;
type StoryboardWarning = import("@/types/storyboard").StoryboardWarning;

/* ------------------------------- arguments -------------------------------- */

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const docs = (flag("doc") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const outDir = path.resolve(ROOT, flag("out") ?? "verification/fase2/before");
const prompt = flag("prompt");

if (docs.length === 0) {
  console.error("Uso: --doc <archivo>[,<archivo>] [--out <dir>]");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY (se lee de .env.local).");
  process.exit(1);
}

/* -------------------------------- summary --------------------------------- */

function summarize(storyboard: Storyboard, warnings: StoryboardWarning[]): string {
  const lines = [
    `# ${storyboard.videoTitle}`,
    "",
    `idioma: ${storyboard.language} · ${storyboard.scenes.length} escenas · ${storyboard.totalSeconds}s`,
    "",
  ];

  for (const scene of storyboard.scenes) {
    lines.push(`## ${scene.index}. ${scene.title} (${scene.durationSeconds}s)`);
    lines.push("");
    lines.push(`> ${scene.narration}`);
    lines.push("");
    lines.push(`layout: \`${scene.layout}\``);
    lines.push("");
    for (const step of scene.steps) {
      const draw = step.draw;
      const detail =
        draw.type === "sketch"
          ? `[${draw.items.map((i) => i.icon + (i.label ? `:"${i.label}"` : "")).join(" ")}] rel=${draw.relation ?? "none"}${draw.caption ? ` pie="${draw.caption}"` : ""}`
          : draw.type === "diagram"
            ? `${draw.kind} [${draw.labels.join(" | ")}]`
            : draw.type === "icon"
              ? draw.id
              : draw.type === "emphasis"
                ? `${draw.shape} -> ${draw.target}`
                : "text" in draw
                  ? `"${draw.text}"`
                  : "";
      lines.push(`- \`${draw.type}\` ${detail}  ← on: "${step.on ?? "(sin frase)"}"`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Avisos del validador", "");
    for (const warning of warnings) lines.push(`- \`${warning.code}\` ${warning.message}`);
    lines.push("");
  }

  return lines.join("\n");
}

/* ---------------------------------- run ----------------------------------- */

await mkdir(outDir, { recursive: true });

const client = new Anthropic();
const ledger = new UsageLedger();

for (const doc of docs) {
  const file = path.resolve(ROOT, doc);
  const name = path.basename(file).replace(/\.[^.]+$/, "");
  const text = await readFile(file, "utf8");
  const words = text.split(/\s+/).filter(Boolean).length;

  console.log(`\n=== ${name} (${words} palabras)`);

  const request = {
    documentText: text,
    documentName: path.basename(file),
    prompt,
    // The ceiling a paid plan would allow. The model still picks the length.
    allowedSeconds: 300,
    documentWords: words,
    style: "classic-whiteboard" as const,
  };

  const result = await generateStoryboard(request, { client, usage: ledger.sink });

  const storyboard = fitToDuration(result.storyboard, result.storyboard.targetSeconds);

  await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(storyboard, null, 2));
  await writeFile(path.join(outDir, `${name}.md`), summarize(storyboard, result.warnings));

  const drawn = storyboard.scenes.reduce(
    (sum, scene) =>
      sum +
      scene.steps.filter((s) =>
        ["sketch", "diagram", "icon"].includes(s.draw.type),
      ).length,
    0,
  );
  console.log(
    `  ${storyboard.scenes.length} escenas · ${storyboard.totalSeconds}s · ${drawn} dibujos · ${result.warnings.length} avisos`,
  );
  for (const warning of result.warnings) console.log(`    · ${warning.code}: ${warning.message}`);
}

console.log(`\n${ledger.report()}`);
console.log(`\nEscrito en ${path.relative(ROOT, outDir)}`);
