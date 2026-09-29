/**
 * The visual plan: what the video is going to draw, decided before anyone
 * writes a line of it.
 *
 * The storyboard model was being asked to do two jobs at once — work out how to
 * teach the subject, and write the shot list — and it did the second one well
 * and the first one not at all. It picked an icon per sentence. So the board
 * showed generic cubes while the narration said "imagine train carriages
 * coupled together", the metaphor changed in every scene, and a slide meant to
 * prove that nodes are *scattered* drew them in a tidy row.
 *
 * So the decision comes first and separately, and it is written down in a form
 * the storyboard has to obey:
 *
 * - **one metaphor** for the whole video, with a reason;
 * - **a cast** of pieces that recur, each tied to what it means and to how the
 *   engine will actually draw it;
 * - **roles**, so a colour means one thing for the length of a video;
 * - **per scene**, the `claim` the scene has to prove and the `mustShow` that
 *   proves it — in that order, because a drawing chosen before the claim is a
 *   decoration;
 * - **gaps**, everything the director wanted and the engine could not draw.
 *
 * `gaps` is the part that pays for itself later: it is a list, written by the
 * thing that hit the limit, of what to build next.
 */

import type { DiagramKind, MarkColor, SketchRelation } from "@/types/storyboard";

/** How a cast member gets on the board, in the vocabulary the engine has. */
export type CastDrawing =
  | { kind: "icon"; icon: string }
  | { kind: "sketch"; icons: string[]; relation: SketchRelation }
  | { kind: "diagram"; diagram: DiagramKind };

export interface CastMember {
  /** Short, lowercase, no spaces: "vagon", "enganche", "curva-oferta". */
  id: string;
  /** What it stands for in the subject: "un nodo de la lista". */
  means: string;
  drawWith: CastDrawing;
}

export interface PlannedRole {
  /** "puntero", "concepto-clave", "error", "dato". */
  role: string;
  color: MarkColor;
  why: string;
}

export interface PlannedScene {
  /** The one thing the student has to end up understanding. */
  claim: string;
  /** What has to be visible on the board for the claim to be proven. */
  mustShow: string;
  /** Cast ids that appear in this scene. */
  usesCast: string[];
}

export interface VisualGap {
  /** A thing that cannot be drawn, or an arrangement that cannot be expressed. */
  kind: "object" | "capability";
  /** What was wanted: "icono de vagón de tren", "disposición dispersa". */
  want: string;
  /** What was used instead. */
  fallback: string;
}

export interface VisualPlan {
  metaphor: {
    name: string;
    why: string;
  };
  cast: CastMember[];
  roles: PlannedRole[];
  scenes: PlannedScene[];
  gaps: VisualGap[];
}

/** What the plan says about one scene, or nothing when there is no plan. */
export function sceneOfPlan(plan: VisualPlan | undefined, index: number): PlannedScene | null {
  return plan?.scenes[index] ?? null;
}

/** The colour a role resolves to, or null when the plan does not name it. */
export function colorOfRole(plan: VisualPlan | undefined, role: string | null | undefined) {
  if (!plan || !role) return null;
  return plan.roles.find((entry) => entry.role === role)?.color ?? null;
}
