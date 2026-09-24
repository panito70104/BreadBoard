"use client";

import { Check } from "lucide-react";

import { videoStyles } from "@/data/mock";
import { cn } from "@/lib/utils";
import type { VideoStyle } from "@/types";

export function StyleSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: VideoStyle;
  onChange: (style: VideoStyle) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Estilo del video</legend>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {videoStyles.map((style) => {
          const isSelected = style.id === value;

          return (
            <label
              key={style.id}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-xl border p-3 transition-colors",
                isSelected
                  ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-200"
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="video-style"
                value={style.id}
                checked={isSelected}
                onChange={() => onChange(style.id)}
                className="sr-only"
              />

              <span className="flex items-center justify-between">
                <span
                  className="flex h-8 w-14 items-center justify-center gap-1 rounded-md border border-slate-200"
                  style={{ backgroundColor: style.swatch[0] }}
                  aria-hidden
                >
                  <span
                    className="h-0.5 w-5 rounded-full"
                    style={{ backgroundColor: style.swatch[1] }}
                  />
                  <span
                    className="h-0.5 w-3 rounded-full"
                    style={{ backgroundColor: style.swatch[2] }}
                  />
                </span>
                {isSelected && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
              </span>

              <span className="mt-2.5 text-sm font-medium text-slate-900">
                {style.label}
              </span>
              <span className="mt-0.5 text-xs text-slate-500">{style.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
