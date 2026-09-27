"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Clock, FileText, Palette, Video as VideoIcon } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageBody } from "@/components/dashboard/page-header";
import { StoryboardList } from "@/components/video/storyboard-list";
import { VideoActions } from "@/components/video/video-actions";
import { WhiteboardPlayer } from "@/components/video/whiteboard-player";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { videoStyles } from "@/data/mock";
import { documentDownloadUrl, getVideoById } from "@/lib/api";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import { useVideos } from "@/lib/video-store";
import type { Video } from "@/types";

export default function VideoDetailPage({ params }: PageProps<"/videos/[id]">) {
  const { id } = use(params);
  const { getVideo, isLoading: isStoreLoading } = useVideos();

  const storeVideo = getVideo(id);
  /** Result of the direct fetch used when the store does not have this id. */
  const [fetched, setFetched] = useState<{ id: string; video: Video | null } | null>(null);

  useEffect(() => {
    if (isStoreLoading || storeVideo || fetched?.id === id) return;

    // Deep link or refresh: the store has loaded without this video, so ask
    // the API directly. TODO(backend): GET /videos/:id.
    let cancelled = false;
    void getVideoById(id).then((result) => {
      if (!cancelled) setFetched({ id, video: result });
    });

    return () => {
      cancelled = true;
    };
  }, [id, storeVideo, isStoreLoading, fetched]);

  const video = storeVideo ?? (fetched?.id === id ? fetched.video : null);
  const isLoading = isStoreLoading || (!storeVideo && fetched?.id !== id);

  if (isLoading) {
    return (
      <PageBody>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-6 aspect-video w-full rounded-2xl" />
        <Skeleton className="mt-6 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </PageBody>
    );
  }

  if (!video) {
    return (
      <PageBody>
        <EmptyState
          Icon={VideoIcon}
          title="No encontramos este video"
          description="Puede que lo hayas eliminado o que el enlace esté mal."
          action={
            <Link href="/videos" className={buttonVariants()}>
              Volver a My videos
            </Link>
          }
        />
      </PageBody>
    );
  }

  const style = videoStyles.find((option) => option.id === video.style);

  const meta = [
    {
      label: "Documento fuente",
      value: video.sourceDocument.name,
      hint: `${formatBytes(video.sourceDocument.sizeBytes)}${
        video.sourceDocument.pageCount ? ` · ${video.sourceDocument.pageCount} páginas` : ""
      }`,
      Icon: FileText,
    },
    {
      label: "Duración",
      value: formatDuration(video.durationSeconds),
      hint: `${video.storyboard.length} escenas`,
      Icon: Clock,
    },
    {
      label: "Estilo",
      value: style?.label ?? video.style,
      hint: formatDate(video.createdAt),
      Icon: Palette,
    },
  ];

  return (
    <PageBody>
      <Link
        href="/videos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My videos
      </Link>

      <div className="mt-5">
        <WhiteboardPlayer video={video} />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {video.title}
            </h1>
            <StatusBadge status={video.status} />
          </div>
          {video.prompt && (
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              <span className="font-medium text-slate-700">Pediste:</span> “{video.prompt}”
            </p>
          )}
        </div>
      </div>

      {video.status === "generating" && (
        <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-sm font-medium text-brand-900">
            Estamos generando este video ({video.progress ?? 0}%)
          </p>
          <Progress value={video.progress ?? 0} className="mt-2.5 h-1.5" />
        </div>
      )}

      {video.status === "failed" && video.error && (
        <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {video.error}
        </p>
      )}

      <div className="mt-6">
        <VideoActions video={video} />
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {meta.map(({ label, value, hint, Icon }) => (
          <Card key={label} className="p-4">
            <dt className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </dt>
            <dd className="mt-2 truncate text-sm font-medium text-slate-900">
              {label === "Documento fuente" && video.sourceDocument.id ? (
                <a
                  href={documentDownloadUrl(video.sourceDocument.id)}
                  className="text-brand-700 underline-offset-2 hover:underline"
                  title="Descargar el documento original"
                >
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
            <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>
          </Card>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Storyboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Así se estructuró la explicación antes de dibujarla.
        </p>
        <div className="mt-5">
          <StoryboardList scenes={video.storyboard} />
        </div>
      </section>
    </PageBody>
  );
}
