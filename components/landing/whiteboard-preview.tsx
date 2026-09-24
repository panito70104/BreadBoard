import { CheckCircle2, FileText, Pause, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Hand-drawn stroke that "draws itself" on load. */
function Stroke({
  d,
  delay,
  className,
  strokeWidth = 2.4,
}: {
  d: string;
  delay: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "animate-draw [stroke-dasharray:1] [stroke-dashoffset:1]",
        className,
      )}
    />
  );
}

/**
 * Mock of the product: a whiteboard mid-explanation with a player underneath.
 * Pure CSS/SVG — no video, no canvas, no JS.
 */
export function WhiteboardPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Soft brand glow behind the board */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(99,102,241,0.18),transparent_70%)] blur-xl"
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-float)]">
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-red-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
          </div>
          <p className="truncate text-xs font-medium text-slate-500">
            Biología celular: la mitocondria · Scene 2 de 4
          </p>
        </div>

        {/* The board */}
        <div className="relative bg-white">
          <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
          <svg
            viewBox="0 0 400 236"
            className="relative w-full"
            role="img"
            aria-label="Pizarra con un diagrama celular dibujado a mano"
          >
            <text
              x="28"
              y="40"
              className="font-hand animate-fade-in fill-slate-900 text-[26px]"
              style={{ animationDelay: "150ms" }}
            >
              La mitocondria
            </text>
            <Stroke
              d="M27 50c22 4 52-3 78 1 20 3 38-2 56 1"
              delay={400}
              strokeWidth={3}
              className="stroke-accent-400"
            />

            {/* Cell blob */}
            <Stroke
              d="M64 118c-4-26 22-42 46-34 26 8 34 30 28 52-6 24-32 34-52 26-16-6-20-26-22-44z"
              delay={900}
              className="stroke-slate-800"
            />
            {/* Inner folds */}
            <Stroke
              d="M80 122c10-14 18 8 28-4 9-11 14 10 20 2"
              delay={1500}
              strokeWidth={2}
              className="stroke-brand-500"
            />
            <Stroke
              d="M82 140c10-12 20 6 30-4 8-8 14 8 20 0"
              delay={1750}
              strokeWidth={2}
              className="stroke-brand-500"
            />

            {/* Arrow to the notes */}
            <Stroke
              d="M152 128c26-8 38-10 64-11"
              delay={2050}
              strokeWidth={2}
              className="stroke-slate-400"
            />
            <Stroke
              d="M208 111l10 6-10 7"
              delay={2300}
              strokeWidth={2}
              className="stroke-slate-400"
            />

            {/* Notes on the right */}
            <text
              x="232"
              y="94"
              className="font-hand animate-fade-in fill-slate-800 text-[17px]"
              style={{ animationDelay: "2400ms" }}
            >
              Produce ATP
            </text>
            <Stroke
              d="M232 104c22 2 44-2 66 1"
              delay={2550}
              strokeWidth={2.2}
              className="stroke-marker-green"
            />
            <text
              x="232"
              y="132"
              className="font-hand animate-fade-in fill-slate-800 text-[17px]"
              style={{ animationDelay: "2700ms" }}
            >
              Doble membrana
            </text>
            <text
              x="232"
              y="168"
              className="font-hand animate-fade-in fill-slate-800 text-[17px]"
              style={{ animationDelay: "2950ms" }}
            >
              ADN propio
            </text>
            {/* Hand-drawn box around the key idea */}
            <Stroke
              d="M224 76c36-4 74-3 110-1 4 18 3 82-1 110-38 3-76 2-112 0-3-30-3-80 3-109z"
              delay={3150}
              strokeWidth={1.8}
              className="stroke-brand-300"
            />

            {/* The marker doing the writing */}
            <g
              className="animate-fade-in"
              style={{ animationDelay: "3200ms" }}
              transform="translate(322 176) rotate(28)"
            >
              <rect x="0" y="0" width="10" height="42" rx="3" className="fill-brand-600" />
              <path d="M0 42h10l-5 12z" className="fill-slate-800" />
            </g>
          </svg>
        </div>

        {/* Player bar */}
        <div className="flex items-center gap-3 border-t border-slate-100 bg-white px-4 py-3">
          <span className="animate-pulse-ring flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
            <Pause className="size-4 fill-current" aria-hidden />
          </span>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[38%] rounded-full bg-brand-600" />
            </div>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">1:12 / 3:00</span>
          <Volume2 className="size-4 text-slate-400" aria-hidden />
        </div>
      </div>

      {/* Floating context chips */}
      <div className="animate-float-slow absolute -top-10 left-2 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[var(--shadow-card)] sm:flex lg:-left-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <FileText className="size-4" aria-hidden />
        </span>
        <span className="text-xs">
          <span className="block font-medium text-slate-900">Biologia-Cap3.pdf</span>
          <span className="text-slate-500">32 páginas</span>
        </span>
      </div>

      <div
        className="animate-float-slow absolute -right-7 -bottom-9 hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[var(--shadow-card)] sm:flex lg:-right-8"
        style={{ animationDelay: "1.5s" }}
      >
        <CheckCircle2 className="size-5 text-emerald-500" aria-hidden />
        <span className="text-xs">
          <span className="block font-medium text-slate-900">Video listo</span>
          <span className="text-slate-500">en 2 min 40 s</span>
        </span>
      </div>
    </div>
  );
}
