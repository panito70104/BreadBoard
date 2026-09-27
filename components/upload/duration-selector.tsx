"use client";

import { Lock } from "lucide-react";

import { videoDurations } from "@/data/mock";
import { cn } from "@/lib/utils";
import type { VideoDurationMinutes } from "@/types";

export function DurationSelector({
  value,
  onChange,
  disabled = false,
  maxMinutes,
}: {
  value: VideoDurationMinutes;
  onChange: (duration: VideoDurationMinutes) => void;
  disabled?: boolean;
  /** Longest video the plan allows; longer options show as locked. */
  maxMinutes?: number;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Duración</legend>

      <div className="mt-3 flex gap-2">
        {videoDurations.map((duration) => {
          const isSelected = duration.id === value;
          const isLocked = maxMinutes !== undefined && duration.id > maxMinutes;

          return (
            <label
              key={duration.id}
              title={isLocked ? "Tu plan no incluye videos de esta duración" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center rounded-xl border px-3 py-2.5 text-center transition-colors",
                isLocked
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
                  : "cursor-pointer",
                !isLocked &&
                  (isSelected
                    ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-200"
                    : "border-slate-200 bg-white hover:border-slate-300"),
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="video-duration"
                value={duration.id}
                checked={isSelected}
                disabled={isLocked}
                onChange={() => onChange(duration.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-sm font-semibold",
                  isSelected && !isLocked ? "text-brand-700" : "text-slate-900",
                )}
              >
                {isLocked && <Lock className="size-3" aria-hidden />}
                {duration.label}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">
                {isLocked ? "Plan superior" : duration.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
