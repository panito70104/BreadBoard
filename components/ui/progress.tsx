import { cn } from "@/lib/utils";

export interface ProgressProps {
  /** 0–100 */
  value: number;
  className?: string;
  label?: string;
  tone?: "brand" | "success" | "danger";
}

const TONE_CLASSES = {
  brand: "bg-brand-600",
  success: "bg-emerald-500",
  danger: "bg-red-500",
} as const;

export function Progress({ value, className, label, tone = "brand" }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONE_CLASSES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
