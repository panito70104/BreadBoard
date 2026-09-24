import {
  ArrowRight,
  Eraser,
  Heading,
  ListChecks,
  Network,
  PenLine,
  Shapes,
  Sigma,
  Type,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { LAYOUTS } from "@/lib/storyboard/layouts";
import { formatDuration } from "@/lib/utils";
import type { DrawElement, DrawElementType, StoryboardScene } from "@/types";

const ELEMENT_ICONS: Record<DrawElementType, typeof Type> = {
  title: Heading,
  text: Type,
  bullet: ListChecks,
  icon: Shapes,
  arrow: ArrowRight,
  emphasis: PenLine,
  diagram: Network,
  formula: Sigma,
  erase: Eraser,
};

/** One-line human description of what a step puts on the board. */
function describe(element: DrawElement): string {
  switch (element.type) {
    case "title":
      return `Escribe el título “${element.text}”`;
    case "text":
      return `Escribe “${element.text}”`;
    case "bullet":
      return `Viñeta: ${element.text}`;
    case "icon":
      return `Dibuja el icono ${element.id}`;
    case "arrow":
      return `Flecha de ${element.from} a ${element.to}`;
    case "emphasis":
      return `Resalta ${element.target === "prev" ? "lo anterior" : element.target} con ${element.shape}`;
    case "diagram":
      return `Diagrama ${element.kind}: ${element.labels.join(" → ")}`;
    case "formula":
      return `Fórmula: ${element.text}`;
    case "erase":
      return element.scope === "board" ? "Borra la pizarra" : `Borra ${element.scope}`;
  }
}

/** The scene-by-scene plan the render follows. */
export function StoryboardList({ scenes }: { scenes: StoryboardScene[] }) {
  if (scenes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-500">
        Este video no llegó a generar su storyboard.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {scenes.map((scene) => (
        <Card as="li" key={scene.id} className="flex gap-4 p-4 sm:p-5">
          <span className="font-hand flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xl text-white">
            {scene.index}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{scene.title}</h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {LAYOUTS[scene.layout].label}
                </span>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {formatDuration(scene.durationSeconds)}
                </span>
              </div>
            </div>

            <p className="mt-1.5 text-sm text-slate-600">{scene.summary}</p>

            <p className="mt-3 border-l-2 border-brand-200 pl-3 text-sm text-slate-500 italic">
              “{scene.narration}”
            </p>

            {scene.steps.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {scene.steps.map((step, stepIndex) => {
                  const Icon = ELEMENT_ICONS[step.draw.type];
                  return (
                    <li
                      key={`${scene.id}-${stepIndex}`}
                      className="flex items-start gap-2 text-xs text-slate-500"
                    >
                      <Icon className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className="min-w-0">
                        {describe(step.draw)}
                        {step.on && (
                          <span className="text-slate-400"> · al decir “{step.on}”</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      ))}
    </ol>
  );
}
