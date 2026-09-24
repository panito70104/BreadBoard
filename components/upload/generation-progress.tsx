import { Check, CircleAlert, Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { GenerationStep } from "@/types";

function StepIcon({ state }: { state: GenerationStep["state"] }) {
  if (state === "done") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="size-4" aria-hidden />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="animate-pulse-ring flex size-7 items-center justify-center rounded-full bg-brand-600 text-white">
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </span>
    );
  }

  if (state === "failed") {
    return (
      <span className="flex size-7 items-center justify-center rounded-full bg-red-500 text-white">
        <CircleAlert className="size-4" aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex size-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-xs font-medium text-slate-400" />
  );
}

export function GenerationProgress({
  steps,
  progress,
  className,
}: {
  steps: GenerationStep[];
  progress: number;
  className?: string;
}) {
  const activeStep = steps.find((step) => step.state === "active") ?? steps.at(-1);

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {activeStep?.label ?? "Preparando"}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{activeStep?.description}</p>
        </div>
        <span className="font-mono text-sm font-medium text-brand-700 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      <Progress value={progress} className="mt-4" label="Progreso de generación" />

      <ol className="mt-6 space-y-0">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepIcon state={step.state} />
              {index < steps.length - 1 && (
                <span
                  className={cn(
                    "w-0.5 flex-1 transition-colors",
                    step.state === "done" ? "bg-emerald-400" : "bg-slate-200",
                  )}
                />
              )}
            </div>

            <div className={cn("pb-5", index === steps.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium transition-colors",
                  step.state === "pending" ? "text-slate-400" : "text-slate-900",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
