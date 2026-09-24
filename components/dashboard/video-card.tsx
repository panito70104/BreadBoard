import Link from "next/link";
import { Clock, FileText, Play } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  cn,
  formatDuration,
  formatRelativeDate,
  thumbnailGradient,
} from "@/lib/utils";
import type { Video } from "@/types";

/** Mock thumbnail: a gradient board with a hand-written title. */
function Thumbnail({ video }: { video: Video }) {
  const [from, to] = thumbnailGradient(video.id);

  return (
    <div
      className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-200"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
      <p className="font-hand relative line-clamp-2 px-5 text-center text-xl text-slate-800">
        {video.title}
      </p>
      {video.status === "ready" && (
        <span className="absolute right-3 bottom-3 rounded-full bg-slate-900/80 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
          {formatDuration(video.durationSeconds)}
        </span>
      )}
    </div>
  );
}

export function VideoCard({ video, className }: { video: Video; className?: string }) {
  return (
    <Card
      as="article"
      className={cn(
        "flex flex-col p-3 transition-shadow hover:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Link href={`/videos/${video.id}`} className="group relative">
        <Thumbnail video={video} />
        {video.status === "ready" && (
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-md">
              <Play className="size-5 fill-current" aria-hidden />
            </span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">
            <Link href={`/videos/${video.id}`} className="hover:text-brand-700">
              {video.title}
            </Link>
          </h3>
          <StatusBadge status={video.status} />
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{video.sourceDocument.name}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          {formatRelativeDate(video.createdAt)}
        </p>

        {video.status === "generating" && (
          <div className="mt-3">
            <Progress value={video.progress ?? 0} className="h-1.5" />
            <p className="mt-1.5 text-xs text-slate-500">
              Generando… {video.progress ?? 0}%
            </p>
          </div>
        )}

        {video.status === "failed" && video.error && (
          <p className="mt-3 line-clamp-2 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">
            {video.error}
          </p>
        )}

        <div className="mt-4 flex-1" />

        <Link
          href={`/videos/${video.id}`}
          className={buttonVariants({
            variant: video.status === "ready" ? "outline" : "ghost",
            size: "sm",
            className: "w-full",
          })}
        >
          {video.status === "ready" ? "Watch video" : "Ver detalle"}
        </Link>
      </div>
    </Card>
  );
}
