"use client";

import { videoDurations } from "@/data/mock";
import { cn } from "@/lib/utils";
import type { VideoDurationMinutes } from "@/types";

export function DurationSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: VideoDurationMinutes;
  onChange: (duration: VideoDurationMinutes) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Duración</legend>

      <div className="mt-3 flex gap-2">
        {videoDurations.map((duration) => {
          const isSelected = duration.id === value;

          return (
            <label
              key={duration.id}
              className={cn(
                "flex flex-1 cursor-pointer flex-col items-center rounded-xl border px-3 py-2.5 text-center transition-colors",
                isSelected
                  ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-200"
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="video-duration"
                value={duration.id}
                checked={isSelected}
                onChange={() => onChange(duration.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  isSelected ? "text-brand-700" : "text-slate-900",
                )}
              >
                {duration.label}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{duration.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
