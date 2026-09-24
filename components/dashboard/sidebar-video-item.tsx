import Link from "next/link";

import { StatusDot } from "@/components/ui/status-badge";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { Video } from "@/types";

export function SidebarVideoItem({
  video,
  isActive,
  onNavigate,
}: {
  video: Video;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={`/videos/${video.id}`}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors",
        isActive ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/70",
      )}
    >
      <StatusDot status={video.status} className="mt-1.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">
          {video.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          {formatRelativeDate(video.createdAt)}
          {video.status === "generating" && (
            <span className="text-brand-600">· {video.progress ?? 0}%</span>
          )}
        </span>
      </span>
    </Link>
  );
}
