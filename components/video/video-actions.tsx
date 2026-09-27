"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CircleAlert, Download, RefreshCw, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { regenerateVideo } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useVideos } from "@/lib/video-store";
import type { Video } from "@/types";

export function VideoActions({ video }: { video: Video }) {
  const router = useRouter();
  const { refresh: refreshUser } = useAuth();
  const { addVideo, removeVideo } = useVideos();

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"regenerate" | "delete" | null>(null);

  function flash(message: string) {
    setError(null);
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  }

  async function handleRegenerate() {
    const minutes = video.requestedMinutes ?? 1;
    if (
      !window.confirm(
        `Regenerar vuelve a leer tu documento y usa ${minutes} min de tu plan. ¿Continuar?`,
      )
    ) {
      return;
    }
    setBusy("regenerate");
    setError(null);
    try {
      const updated = await regenerateVideo(video.id);
      // Back to "generating": the store starts polling and this page follows.
      addVideo(updated);
      void refreshUser();
      flash("Generando de nuevo. Esta página se actualiza sola.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos regenerar el video.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar este video y su documento? No se puede deshacer.")) return;
    setBusy("delete");
    setError(null);
    try {
      await removeVideo(video.id);
      router.replace("/videos");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos eliminar el video.");
      setBusy(null);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/videos/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Enlace copiado. Por ahora solo se abre con tu cuenta; compartir con otras personas llega pronto.");
    } catch {
      setError("No pudimos copiar el enlace.");
    }
  }

  const isGenerating = video.status === "generating";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={video.status !== "ready"}
          onClick={() =>
            flash("La descarga en MP4 llega pronto. Mientras tanto, el video se ve aquí mismo.")
          }
        >
          <Download className="size-4" aria-hidden />
          Download
        </Button>

        <Button
          variant="outline"
          onClick={handleRegenerate}
          isLoading={busy === "regenerate"}
          disabled={isGenerating || busy !== null}
        >
          <RefreshCw className="size-4" aria-hidden />
          Regenerate
        </Button>

        <Button variant="outline" onClick={handleShare} disabled={busy !== null}>
          <Share2 className="size-4" aria-hidden />
          Share
        </Button>

        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={handleDelete}
          isLoading={busy === "delete"}
          disabled={isGenerating || busy !== null}
        >
          <Trash2 className="size-4" aria-hidden />
          Eliminar
        </Button>
      </div>

      {notice && (
        <p className="animate-fade-in flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}
      {error && (
        <p className="animate-fade-in flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
