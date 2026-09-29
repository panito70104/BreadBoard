/**
 * The handwriting face, loaded before a single frame is allowed to render.
 *
 * The board measures every piece of text with a canvas, and a canvas does not
 * know a web font until it has loaded. Measure too early and the whole layout —
 * line breaks, block heights, the slot scale they force, the position of every
 * glyph the hand sits on — is computed against the fallback face and is simply
 * wrong. In the Player that self-corrects, because the composition re-plans when
 * `document.fonts.ready` resolves. A still has no second chance: whatever the
 * numbers are when the frame is captured is what gets written to the PNG.
 *
 * So the frame is held with `delayRender()` until the face is genuinely
 * available, and if it never arrives the render is failed rather than quietly
 * producing a still measured with the fallback — a verification image drawn in
 * the wrong font verifies nothing.
 */

import { cancelRender, continueRender, delayRender } from "remotion";

import { clearTextCache } from "@/lib/engine/text";

/** Matches `--font-hand` in `app/globals.css`, minus the Next.js font wrapper. */
export const HAND_FAMILY = "Caveat";

const PROBE = `400 86px "${HAND_FAMILY}"`;

const handle = delayRender(`Cargando la tipografía ${HAND_FAMILY}`, {
  timeoutInMilliseconds: 60_000,
});

async function loadHandFont() {
  // `next/font` is a build step of the Next app and does not exist in this
  // bundle, so the face is fetched the plain way and pinned to the same CSS
  // variable the engine resolves (`lib/engine/text.ts` reads it off :root).
  document.documentElement.style.setProperty("--font-hand", `"${HAND_FAMILY}"`);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  // `display=block` so the browser never paints a frame in the fallback face
  // while it waits.
  link.href = `https://fonts.googleapis.com/css2?family=${HAND_FAMILY}:wght@400;700&display=block`;
  const stylesheet = new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
  document.head.appendChild(link);
  await stylesheet;

  await Promise.all([
    document.fonts.load(PROBE),
    document.fonts.load(`700 86px "${HAND_FAMILY}"`),
  ]);
  await document.fonts.ready;

  if (!document.fonts.check(PROBE)) {
    throw new Error(
      `La tipografía ${HAND_FAMILY} no cargó: el still se mediría con la fuente de respaldo y no serviría para verificar.`,
    );
  }

  // Anything measured before now used the fallback face. Throw it away so the
  // first planned frame is measured against the real one.
  clearTextCache();
}

loadHandFont().then(
  () => continueRender(handle),
  (error) => cancelRender(error),
);
