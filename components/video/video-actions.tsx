"use client";

import { useState } from "react";
import { Check, Download, RefreshCw, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { regenerateVideo } from "@/lib/api";
import { useVideos } from "@/lib/video-store";
import type { Video } from "@/types";

/**
 * Download / Regenerate / Share.
 * All three are mocked: nothing is downloaded and no link is created.
 */
export function VideoActions({ video }: { video: Video }) {
  const { updateVideo } = useVideos();
  const [notice, setNotice] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      // TODO(backend): POST /videos/:id/regenerate and follow the job stream.
      const updated = await regenerateVideo(video.id);
      updateVideo(video.id, {
        status: updated.status,
        progress: 0,
        error: undefined,
      });
      flash("Regeneración encolada. Te avisamos cuando esté lista.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/videos/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Enlace copiado al portapapeles.");
    } catch {
      flash("No pudimos copiar el enlace.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={video.status !== "ready"}
          onClick={() => flash("En la versión real descargarías el MP4 desde S3/R2.")}
        >
          <Download className="size-4" aria-hidden />
          Download
        </Button>

        <Button variant="outline" onClick={handleRegenerate} isLoading={isRegenerating}>
          <RefreshCw className="size-4" aria-hidden />
          Regenerate
        </Button>

        <Button variant="outline" onClick={handleShare}>
          <Share2 className="size-4" aria-hidden />
          Share
        </Button>
      </div>

      {notice && (
        <p className="animate-fade-in flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      )}
    </div>
  );
}
