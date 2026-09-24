"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Video as VideoIcon } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { VideoCard } from "@/components/dashboard/video-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useVideos } from "@/lib/video-store";
import type { VideoStatus } from "@/types";

const FILTERS: Array<{ id: VideoStatus | "all"; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "ready", label: "Ready" },
  { id: "generating", label: "Generating" },
  { id: "failed", label: "Failed" },
];

export default function MyVideosPage() {
  const { videos, isLoading } = useVideos();
  const [filter, setFilter] = useState<VideoStatus | "all">("all");

  const filtered =
    filter === "all" ? videos : videos.filter((video) => video.status === filter);

  return (
    <PageBody>
      <PageHeader
        title="My videos"
        description="Tu biblioteca de explicaciones, lista para repasar."
        actions={
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" aria-hidden />
            Nuevo video
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const count =
            option.id === "all"
              ? videos.length
              : videos.filter((video) => video.status === option.id).length;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === option.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "text-xs",
                  filter === option.id ? "text-slate-300" : "text-slate-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            Icon={VideoIcon}
            title="Nada por aquí todavía"
            description={
              filter === "all"
                ? "Sube tu primer PDF y genera la explicación en video."
                : "No tienes videos en este estado."
            }
            action={
              <Link href="/dashboard" className={buttonVariants()}>
                <Plus className="size-4" aria-hidden />
                Nuevo video
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </PageBody>
  );
}
