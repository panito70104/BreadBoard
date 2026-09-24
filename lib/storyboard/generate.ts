/**
 * Storyboard generation with the Claude API.
 *
 * SERVER ONLY. This reads `ANTHROPIC_API_KEY` and must never be imported from a
 * client component — call it from a route handler or a server action.
 *
 * Two layers guard the output:
 *
 * 1. **Structured outputs** constrain Claude to `strictStoryboardSchema`, so a
 *    layout that is not a layout or an icon outside the vocabulary cannot come
 *    back at all.
 * 2. **`parseStoryboard`** then repairs what a schema cannot express — a slot
 *    the chosen layout lacks, a trigger phrase missing from the narration,
 *    more bullets than fit — and reports each fix as a warning.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildStoryboardUserPrompt,
  STORYBOARD_SYSTEM_PROMPT,
  type StoryboardRequest,
} from "@/lib/storyboard/prompt";
import { parseStoryboard, strictStoryboardSchema } from "@/lib/storyboard/schema";
import type { StoryboardParseResult } from "@/types/storyboard";

/** Writing a lesson plan from a document is reasoning work — keep Opus. */
const MODEL = "claude-opus-5";

export class StoryboardGenerationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StoryboardGenerationError";
  }
}

export async function generateStoryboard(
  request: StoryboardRequest,
  client: Anthropic = new Anthropic(),
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
      messages: [{ role: "user", content: buildStoryboardUserPrompt(request) }],
    });
  } catch (cause) {
    if (cause instanceof Anthropic.RateLimitError) {
      throw new StoryboardGenerationError(
        "Estamos generando muchos videos ahora mismo. Inténtalo en un minuto.",
        cause,
      );
    }
    if (cause instanceof Anthropic.APIError) {
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
  });
}
