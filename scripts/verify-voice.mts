/**
 * Checks the piece that decides when every drawing happens.
 *
 *   npm run voice:verify
 *
 * `phraseStart` maps a trigger phrase onto the second it is spoken, which means
 * comparing text with accents, case and punctuation folded away while still
 * pointing back at a position in the original string — the timings are indexed
 * by that. Get the map wrong by one and every drawing in the video lands late.
 *
 * It also checks the other promise the voice makes: that a minute bought comes
 * out about a minute long. Running long is corrected by reading faster, up to a
 * cap; running short is corrected by giving the drawing the spare seconds.
 *
 * No network and no API key: the alignment is synthetic, one character per
 * tenth of a second, and the length maths is pure, so every expected answer is
 * arithmetic.
 */

import { phraseStart } from "@/lib/server/voice/align";
import { MAX_STRETCH, paceFor, stretch } from "@/lib/server/voice/length";
import { normalizeWithIndex } from "@/lib/storyboard/normalize";
import type { StoryboardScene } from "@/types/storyboard";

const fail: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) fail.push(what); };

/** An alignment where every character lasts a tenth of a second. */
function fakeAlignment(text: string) {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * 0.1),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.1),
  };
}

const narration = "Imagina que tienes cien pesos. Un año después, ¡solo te alcanza para uno!";
const alignment = fakeAlignment(narration);

// The phrase starts at character 31 ("Un año después") -> 3.1s.
const at = phraseStart(alignment, "Un año después");
check(at !== null && Math.abs(at - 3.1) < 1e-9, `"Un año después" cayó en ${at}, esperaba 3.1`);

// Accents, case and punctuation must not matter.
check(phraseStart(alignment, "un ano despues") === at, "la búsqueda no tolera acentos/mayúsculas");
check(phraseStart(alignment, "¡Un año, después!") === at, "la búsqueda no tolera puntuación distinta");

// The first phrase starts at zero.
check(phraseStart(alignment, "Imagina que tienes") === 0, "la primera frase no cayó en 0");

// A phrase that is not spoken has no time.
check(phraseStart(alignment, "esto no está") === null, "encontró una frase que no existe");
check(phraseStart(alignment, "") === null, "una frase vacía devolvió un tiempo");

// The index map has to survive characters that fold away and runs of punctuation.
const mapped = normalizeWithIndex("¿Qué   tal — así?");
check(mapped.text === "que tal asi", `normalizó a "${mapped.text}"`);
check(mapped.index.length === mapped.text.length, "el mapa no acompaña al texto");
check("¿Qué   tal — así?"[mapped.index[0]] === "Q", "el mapa no apunta al carácter original");
const asiAt = mapped.text.indexOf("asi");
check("¿Qué   tal — así?"[mapped.index[asiAt]] === "a", "el mapa se desalinea tras la puntuación");

// A phrase sitting right after collapsed whitespace still resolves.
const spaced = fakeAlignment("Uno.   Dos    tres.");
const dos = phraseStart(spaced, "Dos tres");
check(dos !== null && Math.abs(dos - 0.7) < 1e-6, `"Dos tres" cayó en ${dos}, esperaba 0.7`);

/* ------------------------------ the length ------------------------------- */

const MAX_SPEED = 1.2;
const minute = 60;

// Comfortably inside the band: leave it alone.
check(paceFor(58, minute, MAX_SPEED) === null, "aceleró una narración que ya cabía");
check(paceFor(66, minute, MAX_SPEED) === null, "aceleró por un 10% de más, dentro de la tolerancia");
// Short is never fixed by reading slowly.
check(paceFor(40, minute, MAX_SPEED) === null, "frenó la voz para rellenar, que suena a avería");

// Long: read faster, but never past the cap.
const mild = paceFor(69, minute, MAX_SPEED);
check(mild !== null && Math.abs(mild - 1.15) < 1e-9, `69s en 60s pidió ${mild}x, esperaba 1.15x`);
check(paceFor(90, minute, MAX_SPEED) === MAX_SPEED, "no respetó el tope de velocidad");

const scenes = (durations: number[]) =>
  durations.map((durationSeconds, index) => ({
    id: `s${index}`,
    index: index + 1,
    title: "",
    summary: "",
    narration: "",
    layout: "title-bullets",
    steps: [],
    durationSeconds,
  })) as StoryboardScene[];

const total = (list: StoryboardScene[]) =>
  list.reduce((sum, scene) => sum + scene.durationSeconds, 0);

// Short by a fifth: the drawing gets the rest, and the video lands on a minute.
const filled = total(stretch(scenes([16, 16, 16]), minute));
check(Math.abs(filled - minute) < 0.5, `48s se estiraron a ${filled}s, esperaba 60s`);

// Already close enough: untouched.
check(total(stretch(scenes([19, 19, 19]), minute)) === 57, "estiró una duración que ya estaba bien");

// Far too short: capped, so the video is short rather than mostly silence.
const capped = total(stretch(scenes([10, 10, 10]), minute));
check(
  Math.abs(capped - 30 * MAX_STRETCH) < 0.5,
  `30s se estiraron a ${capped}s, esperaba el tope de ${30 * MAX_STRETCH}s`,
);

// Never padded past the target.
check(total(stretch(scenes([30, 30]), minute)) === 60, "estiró un video que ya duraba lo pedido");

if (fail.length) {
  console.log("FALLOS:");
  for (const message of fail) console.log(" -", message);
  process.exit(1);
}
console.log("El alineador y el ajuste de duración se comportan.");
