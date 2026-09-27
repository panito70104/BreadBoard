/**
 * Storyboard generation with the Claude API.
 *
 * SERVER ONLY. This reads `ANTHROPIC_API_KEY` and must never be imported from a
 * client component — call it from a route handler or a server action.
 *
 * Three layers guard the output:
 *
 * 1. **Structured outputs** constrain Claude to `strictStoryboardSchema`, so a
 *    layout that is not a layout or an icon outside the vocabulary cannot come
 *    back at all.
 * 2. **`parseStoryboard`** then repairs what a schema cannot express — a slot
 *    the chosen layout lacks, a trigger phrase missing from the narration,
 *    more bullets than a scene should ever hold — and reports each fix.
 * 3. **`visualHealth`** asks the one question neither of those can: did it
 *    actually draw anything? A whiteboard video whose board is all bullets has
 *    failed at the thing it exists to do, and no repair pass can invent the
 *    pictures — so that one is worth paying for a second attempt.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildStoryboardUserPrompt,
  STORYBOARD_SYSTEM_PROMPT,
  type StoryboardRequest,
} from "@/lib/storyboard/prompt";
import {
  parseStoryboard,
  strictStoryboardSchema,
  visualHealth,
  type VisualHealth,
} from "@/lib/storyboard/schema";
import type { StoryboardParseResult } from "@/types/storyboard";

/** Writing a lesson plan from a document is reasoning work — keep Opus. */
const MODEL = "claude-opus-5";

export class StoryboardGenerationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StoryboardGenerationError";
  }
}

async function ask(
  client: Anthropic,
  request: StoryboardRequest,
  message: string,
): Promise<StoryboardParseResult> {
  let response;

  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(strictStoryboardSchema),
      },
      // The system prompt is generated from the layout and icon catalogs, so it
      // is byte-stable across requests and caches cleanly.
      system: [
        {
          type: "text",
          text: STORYBOARD_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: message }],
    });
  } catch (cause) {
    if (cause instanceof Anthropic.RateLimitError) {
      throw new StoryboardGenerationError(
        "Estamos generando muchos videos ahora mismo. Inténtalo en un minuto.",
        cause,
      );
    }
    if (cause instanceof Anthropic.APIError) {
      // The status alone is useless: a 400 from structured outputs says
      // precisely what is wrong with the schema, and swallowing it means the
      // next person has to reproduce the call by hand to find out. The user
      // still gets the short version.
      console.error(
        `[storyboard] ${cause.status} ${cause.name}`,
        JSON.stringify({ requestId: cause.requestID, error: cause.error }),
      );
      throw new StoryboardGenerationError(
        `El servicio de guiones respondió ${cause.status}.`,
        cause,
      );
    }
    throw cause;
  }

  if (response.stop_reason === "refusal") {
    throw new StoryboardGenerationError(
      "No pudimos generar un guion para este documento.",
      response.stop_details,
    );
  }
  if (response.stop_reason === "max_tokens") {
    throw new StoryboardGenerationError(
      "El guion salió demasiado largo. Prueba con una duración menor.",
    );
  }
  if (!response.parsed_output) {
    throw new StoryboardGenerationError("El modelo no devolvió un guion válido.");
  }

  // Structured outputs got the shape right; this fixes the meaning.
  return parseStoryboard(response.parsed_output, {
    fallbackTitle: request.documentName,
    allowedSeconds: request.allowedSeconds,
  });
}

/** Said to a model that wrote a lecture when it was asked to draw one. */
function correction(health: VisualHealth): string {
  return [
    "",
    "CORRECCIÓN — el guion anterior no sirve:",
    `escribió ${health.written} líneas de texto y solo dibujó ${health.drawings} cosas, y ${health.scenes - health.drawn} de ${health.scenes} escenas no dibujan nada.`,
    "Eso es una presentación con diapositivas, no un video de pizarra.",
    "Rehazlo entero. Cada escena empieza por un dibujo y como mucho lleva dos viñetas,",
    "y las viñetas son el pie de foto del dibujo, nunca la explicación.",
    "Donde antes escribiste una idea abstracta, busca el objeto concreto que la representa y dibújalo con \"sketch\".",
  ].join("\n");
}

export async function generateStoryboard(
  request: StoryboardRequest,
  client: Anthropic = new Anthropic(),
): Promise<StoryboardParseResult> {
  const prompt = buildStoryboardUserPrompt(request);
  const first = await ask(client, request, prompt);

  const health = visualHealth(first.storyboard);
  if (health.ok) return first;

  const second = await ask(client, request, prompt + "\n" + correction(health));
  const retried = visualHealth(second.storyboard);

  // Keep whichever drew more; a second attempt is not automatically better.
  const best = retried.drawings > health.drawings ? second : first;
  return {
    ...best,
    clean: false,
    warnings: [
      ...best.warnings,
      {
        code: "text-heavy",
        message: `El primer guion traía ${health.drawings} dibujos para ${health.written} líneas de texto; se pidió de nuevo y se usó el que más dibuja (${Math.max(health.drawings, retried.drawings)}).`,
      },
    ],
  };
}
