/**
 * The art direction call: a visual plan for the video, before the storyboard.
 *
 * SERVER ONLY — reads `ANTHROPIC_API_KEY`.
 *
 * Same shape as `generate.ts`: Claude with structured outputs, a system prompt
 * generated from the catalogs and cached for an hour, and a repair pass after
 * for the things a schema cannot express (an icon outside the vocabulary, a
 * scene pointing at a cast member that does not exist).
 *
 * The one rule that outranks everything here is invariant 5: **a failed plan
 * never stops a generation.** Every caller is expected to catch
 * `ArtDirectionError` and carry on without a plan, which is exactly the
 * pipeline as it was before this file existed.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import {
  ART_DIRECTION_SYSTEM_PROMPT,
  buildArtDirectionUserPrompt,
  type ArtDirectionRequest,
} from "@/lib/storyboard/art-prompt";
import { FALLBACK_ICON, resolveIconId } from "@/lib/storyboard/icons";
import { LIMITS } from "@/lib/storyboard/schema";
import { usageOf, type UsageSink } from "@/lib/storyboard/usage";
import type {
  CastDrawing,
  CastMember,
  PlannedRole,
  PlannedScene,
  VisualGap,
  VisualPlan,
} from "@/types/art-direction";
import type { DiagramKind, MarkColor, SketchRelation } from "@/types/storyboard";

const MODEL = "claude-opus-5";

const MARK_COLORS = ["ink", "brand", "amber", "red", "green", "blue"] as const;
const SKETCH_RELATIONS = ["arrow", "plus", "equals", "vs", "none"] as const;
const DIAGRAM_KINDS = [
  "axes",
  "timeline",
  "flow",
  "compare",
  "cycle",
  "tree",
  "table",
  "bars",
] as const;

export class ArtDirectionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ArtDirectionError";
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Schema                                   */
/* -------------------------------------------------------------------------- */

/**
 * Icon names go over as plain strings for the same reason they do in the
 * storyboard schema: a 244-alternative enum referenced from two places
 * compiles to a decoding grammar the API rejects. The vocabulary is in the
 * system prompt and `resolveIconId` catches the near misses.
 */
const iconName = z.string().describe("Un nombre del catálogo de dibujos.");

const strictPlanSchema = z.object({
  metaphor: z.object({
    name: z.string().describe("La metáfora central, en dos o tres palabras."),
    why: z.string().describe("Por qué esta metáfora explica el concepto."),
  }),
  cast: z.array(
    z.object({
      id: z.string().describe("Corto, en minúsculas y sin espacios."),
      means: z.string().describe("Qué representa en el tema."),
      drawWith: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("icon"), icon: iconName }),
        z.object({
          kind: z.literal("sketch"),
          icons: z.array(iconName),
          relation: z.enum(SKETCH_RELATIONS),
        }),
        z.object({ kind: z.literal("diagram"), diagram: z.enum(DIAGRAM_KINDS) }),
      ]),
    }),
  ),
  roles: z.array(
    z.object({
      role: z.string().describe("Lo que significa en este tema, no el color."),
      color: z.enum(MARK_COLORS),
      why: z.string(),
    }),
  ),
  scenes: z.array(
    z.object({
      claim: z.string().describe("La idea que la escena tiene que probar."),
      mustShow: z.string().describe("Qué debe verse en el tablero para probarla."),
      usesCast: z.array(z.string()),
    }),
  ),
  gaps: z.array(
    z.object({
      kind: z.enum(["object", "capability"]),
      want: z.string(),
      fallback: z.string(),
    }),
  ),
});

/* -------------------------------------------------------------------------- */
/*                                   Repair                                   */
/* -------------------------------------------------------------------------- */

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function repairDrawing(drawing: CastDrawing): CastDrawing {
  if (drawing.kind === "icon") {
    return { kind: "icon", icon: resolveIconId(drawing.icon) ?? FALLBACK_ICON };
  }
  if (drawing.kind === "sketch") {
    const icons = drawing.icons
      .map((icon) => resolveIconId(icon))
      .filter((icon): icon is string => Boolean(icon))
      .slice(0, LIMITS.maxSketchItems);
    // A sketch of one is an icon; saying so here spares the storyboard the
    // repair pass that would otherwise report it as damage.
    if (icons.length === 0) return { kind: "icon", icon: FALLBACK_ICON };
    if (icons.length === 1) return { kind: "icon", icon: icons[0] };
    return { kind: "sketch", icons, relation: drawing.relation as SketchRelation };
  }
  return { kind: "diagram", diagram: drawing.diagram as DiagramKind };
}

/**
 * What a schema cannot say: ids have to be unique and referenceable, a role
 * cannot be declared twice, and a scene cannot point at a cast member that was
 * never defined.
 */
export function repairPlan(raw: z.infer<typeof strictPlanSchema>): {
  plan: VisualPlan;
  warnings: string[];
} {
  const warnings: string[] = [];

  const seenIds = new Set<string>();
  const cast: CastMember[] = [];
  for (const member of raw.cast) {
    const id = slug(member.id) || `pieza-${cast.length + 1}`;
    if (seenIds.has(id)) {
      warnings.push(`el reparto repetía la pieza "${id}"; se quedó la primera`);
      continue;
    }
    seenIds.add(id);
    cast.push({ id, means: member.means, drawWith: repairDrawing(member.drawWith as CastDrawing) });
  }

  const seenRoles = new Set<string>();
  const roles: PlannedRole[] = [];
  for (const entry of raw.roles) {
    const role = slug(entry.role);
    if (!role || seenRoles.has(role)) {
      if (role) warnings.push(`el rol "${role}" estaba definido dos veces; se quedó el primero`);
      continue;
    }
    seenRoles.add(role);
    roles.push({ role, color: entry.color as MarkColor, why: entry.why });
  }

  const scenes: PlannedScene[] = raw.scenes.slice(0, LIMITS.maxScenes).map((scene) => {
    const usesCast: string[] = [];
    for (const id of scene.usesCast) {
      const wanted = slug(id);
      if (seenIds.has(wanted)) usesCast.push(wanted);
      else warnings.push(`la escena "${scene.claim.slice(0, 40)}…" usa "${id}", que no está en el reparto`);
    }
    return { claim: scene.claim, mustShow: scene.mustShow, usesCast };
  });

  const gaps: VisualGap[] = raw.gaps.map((gap) => ({
    kind: gap.kind,
    want: gap.want.trim(),
    fallback: gap.fallback.trim(),
  }));

  if (cast.length === 0) warnings.push("el plan salió sin reparto");
  if (scenes.length === 0) throw new ArtDirectionError("El plan visual salió sin escenas.");

  return { plan: { metaphor: raw.metaphor, cast, roles, scenes, gaps }, warnings };
}

/* -------------------------------------------------------------------------- */
/*                                    Call                                    */
/* -------------------------------------------------------------------------- */

export interface PlanVisualsOptions {
  client?: Anthropic;
  usage?: UsageSink;
  /** Anything the repair pass had to fix, for the caller to log. */
  onWarning?: (message: string) => void;
}

export async function planVisuals(
  request: ArtDirectionRequest,
  options: PlanVisualsOptions = {},
): Promise<VisualPlan> {
  const client = options.client ?? new Anthropic();

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(strictPlanSchema),
      },
      // Generated from the catalogs, so byte-stable. Same hour-long TTL as the
      // storyboard prompt and for the same reason: a study session outlives
      // five minutes, and these two calls happen back to back.
      system: [
        {
          type: "text",
          text: ART_DIRECTION_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [{ role: "user", content: buildArtDirectionUserPrompt(request) }],
    });
  } catch (cause) {
    if (cause instanceof Anthropic.APIError) {
      console.error(
        `[art] ${cause.status} ${cause.name}`,
        JSON.stringify({ requestId: cause.requestID, error: cause.error }),
      );
    }
    throw new ArtDirectionError("No se pudo planificar el video.", cause);
  }

  if (response.stop_reason === "refusal") {
    throw new ArtDirectionError("El director de arte declinó este documento.", response.stop_details);
  }
  if (!response.parsed_output) {
    throw new ArtDirectionError("El director de arte no devolvió un plan válido.");
  }

  options.usage?.({ call: "plan", model: MODEL, ...usageOf(response) });

  const { plan, warnings } = repairPlan(response.parsed_output);
  for (const warning of warnings) options.onWarning?.(warning);
  return plan;
}
