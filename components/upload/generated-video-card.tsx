import Link from "next/link";
import { CheckCircle2, Play, RotateCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatDuration,
  thumbnailGradient,
} from "@/lib/utils";
import type { Video } from "@/types";

/** Success state shown when a generation finishes. */
export function GeneratedVideoCard({
  video,
  onCreateAnother,
}: {
  video: Video;
  onCreateAnother: () => void;
}) {
  const [from, to] = thumbnailGradient(video.id);

  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
        <CheckCircle2 className="size-4.5 text-emerald-600" aria-hidden />
        <p className="text-sm font-medium text-emerald-900">
          Tu video está listo
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        <Link
          href={`/videos/${video.id}`}
          className="group relative block w-full shrink-0 sm:w-64"
        >
          <div
            className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-200"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
            <p className="font-hand relative line-clamp-2 px-4 text-center text-lg text-slate-800">
              {video.title}
            </p>
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition-colors group-hover:bg-slate-900/10">
              <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-brand-700 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                <Play className="size-5 fill-current" aria-hidden />
              </span>
            </span>
            <span className="absolute right-2.5 bottom-2.5 rounded-full bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
              {formatDuration(video.durationSeconds)}
            </span>
          </div>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-base font-semibold text-slate-900">{video.title}</h3>
          <p className="mt-1 truncate text-sm text-slate-500">
            Desde {video.sourceDocument.name}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {video.storyboard.length} escenas ·{" "}
            {formatDuration(video.durationSeconds)} min de explicación
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
            <Link
              href={`/videos/${video.id}`}
              className={buttonVariants({ className: "sm:flex-1" })}
            >
              <Play className="size-4 fill-current" aria-hidden />
              Watch video
            </Link>
            <Button variant="outline" onClick={onCreateAnother}>
              <RotateCcw className="size-4" aria-hidden />
              Crear otro
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
