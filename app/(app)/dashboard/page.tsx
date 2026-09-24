"use client";

import Link from "next/link";
import { ArrowRight, Clock, FileText, Video as VideoIcon } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { VideoCard } from "@/components/dashboard/video-card";
import { GenerationPanel } from "@/components/upload/generation-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useVideos } from "@/lib/video-store";

export default function DashboardPage() {
  const { user } = useAuth();
  const { videos, isLoading } = useVideos();

  const readyVideos = videos.filter((video) => video.status === "ready");
  const totalMinutes = Math.round(
    readyVideos.reduce((total, video) => total + video.durationSeconds, 0) / 60,
  );
  const uniqueDocuments = new Set(videos.map((video) => video.sourceDocument.id)).size;
  const recentVideos = videos.slice(0, 3);

  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <PageBody>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        description="Sube un documento y te devolvemos la explicación en video."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Videos generados"
          value={isLoading ? "—" : String(videos.length)}
          hint={
            user ? `${user.minutesUsed} de ${user.minutesLimit} min este mes` : undefined
          }
          Icon={VideoIcon}
        />
        <StatCard
          label="Minutos de estudio"
          value={isLoading ? "—" : `${totalMinutes} min`}
          hint="Listos para repasar"
          Icon={Clock}
        />
        <StatCard
          label="Documentos"
          value={isLoading ? "—" : String(uniqueDocuments)}
          hint="PDF, DOCX y TXT"
          Icon={FileText}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Crear un video nuevo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Arrastra el documento, elige el estilo y nosotros hacemos el resto.
        </p>
        <div className="mt-5">
          <GenerationPanel />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Videos recientes</h2>
          <Link
            href="/videos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Ver todos
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : recentVideos.length === 0 ? (
          <EmptyState
            className="mt-5"
            Icon={VideoIcon}
            title="Todavía no has generado ningún video"
            description="Sube tu primer documento arriba y aquí aparecerán tus explicaciones."
          />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recentVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </section>
    </PageBody>
  );
}
