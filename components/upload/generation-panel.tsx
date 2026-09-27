"use client";

/**
 * The generator: pick a document, choose how it should be explained, and
 * watch it become a video.
 *
 *   idle -> selected -> uploading -> processing -> done | failed
 *
 * The file is only validated locally when dropped; the upload happens on
 * "Generar", with real progress. After that the server owns the work and the
 * steps follow what it reports, so leaving the page loses nothing.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Info, Sparkles } from "lucide-react";

import { DocumentChip } from "@/components/upload/document-chip";
import { DurationSelector } from "@/components/upload/duration-selector";
import { GeneratedVideoCard } from "@/components/upload/generated-video-card";
import { GenerationProgress } from "@/components/upload/generation-progress";
import { StyleSelector } from "@/components/upload/style-selector";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import {
  getServiceStatus,
  progressForVideo,
  startGeneration,
  stepsForVideo,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { UPLOAD_LIMITS } from "@/lib/config";
import { getDocumentType } from "@/lib/utils";
import { useVideos } from "@/lib/video-store";
import type { ServiceStatus, VideoDurationMinutes, VideoStyle } from "@/types";

type Phase = "idle" | "selected" | "uploading" | "processing";

/** Neutral note: something worth knowing that is not an error. */
function NoticeBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

function validateLocally(file: File): string | null {
  if (!getDocumentType(file.name)) {
    return `Formato no soportado. Acepta ${UPLOAD_LIMITS.acceptedExtensions.join(", ")}.`;
  }
  if (file.size > UPLOAD_LIMITS.maxSizeBytes) return "El archivo supera los 25 MB.";
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

export function GenerationPanel() {
  const { user, refresh: refreshUser } = useAuth();
  const { addVideo, getVideo } = useVideos();

  const usage = user?.usage;
  const maxMinutes = usage?.maxVideoMinutes ?? 1;
  const remaining = usage?.minutesRemaining ?? 0;

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [uploadFraction, setUploadFraction] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VideoStyle>(
    user?.preferences?.defaultStyle ?? "classic-whiteboard",
  );
  const [durationMinutes, setDurationMinutes] = useState<VideoDurationMinutes>(() => {
    const preferred = user?.preferences?.defaultDurationMinutes ?? 1;
    return (preferred <= maxMinutes ? preferred : 1) as VideoDurationMinutes;
  });

  useEffect(() => {
    let cancelled = false;
    getServiceStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The live video comes from the store, which polls while it generates.
  const video = videoId ? (getVideo(videoId) ?? null) : null;
  const steps = useMemo(
    () => stepsForVideo(video, phase === "uploading"),
    [video, phase],
  );
  const progress = progressForVideo(video, uploadFraction);

  function reset() {
    setPhase("idle");
    setFile(null);
    setUploadFraction(0);
    setVideoId(null);
    setError(null);
    setPrompt("");
  }

  function handleFileSelected(selected: File) {
    const problem = validateLocally(selected);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(selected);
    setPhase("selected");
  }

  async function handleGenerate() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setUploadFraction(0);

    try {
      const created = await startGeneration(
        file,
        { style, durationMinutes, prompt: prompt.trim() || undefined },
        setUploadFraction,
      );
      addVideo(created);
      setVideoId(created.id);
      setPhase("processing");
      // Minutes were reserved on the server; show it in the meter now.
      void refreshUser();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos iniciar la generación.");
      setPhase("selected");
    }
  }

  /* ------------------------------- Finished ------------------------------- */

  if (phase === "processing" && video?.status === "ready") {
    return (
      <div className="space-y-4">
        {video.notice && <NoticeBanner>{video.notice}</NoticeBanner>}
        <GeneratedVideoCard video={video} onCreateAnother={reset} />
      </div>
    );
  }

  if (phase === "processing" && video?.status === "failed") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">No pudimos generar el video.</p>
            <p className="mt-0.5">{video.error}</p>
            <p className="mt-1 text-red-600/80">No se descontaron minutos de tu plan.</p>
          </div>
        </div>
        <Button variant="outline" onClick={reset}>
          Probar con otro documento
        </Button>
      </div>
    );
  }

  /* ------------------------------- Working -------------------------------- */

  const isWorking = phase === "uploading" || phase === "processing";
  const exhausted = remaining <= 0;
  const tooLong = durationMinutes > remaining;

  return (
    <div className="space-y-5">
      {status?.storyboardProvider === "mock" && (
        <NoticeBanner>
          <strong>Modo ejemplo.</strong> Claude no está conectado, así que se usará un guion de
          plantilla en lugar de leer tu documento. Añade <code>ANTHROPIC_API_KEY</code> a{" "}
          <code>.env.local</code> y reinicia el servidor.
        </NoticeBanner>
      )}

      {phase === "idle" && <UploadDropzone onFileSelected={handleFileSelected} />}

      {(phase === "selected" || phase === "uploading") && file && (
        <DocumentChip
          name={file.name}
          sizeBytes={file.size}
          uploadProgress={phase === "uploading" ? Math.round(uploadFraction * 100) : undefined}
          onRemove={phase === "selected" ? reset : undefined}
        />
      )}

      {isWorking && (
        <>
          <GenerationProgress steps={steps} progress={progress} />
          {phase === "processing" && (
            <p className="text-center text-xs text-slate-500">
              Puedes salir de esta página: el video seguirá generándose y aparecerá en{" "}
              <Link href="/videos" className="font-medium text-brand-600 hover:text-brand-700">
                My videos
              </Link>
              .
            </p>
          )}
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {!isWorking && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">
              ¿Qué quieres que te expliquen?{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              maxLength={500}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ej: Explícame el capítulo 1 de forma sencilla"
              className="min-h-20"
            />
          </div>

          <StyleSelector value={style} onChange={setStyle} />
          <DurationSelector
            value={durationMinutes}
            onChange={setDurationMinutes}
            maxMinutes={maxMinutes}
          />

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {exhausted ? (
                <>
                  Usaste todos tus minutos de este mes.{" "}
                  <Link href="/billing" className="font-medium text-brand-600">
                    Sube de plan
                  </Link>
                </>
              ) : tooLong ? (
                <>Te quedan {remaining} min: elige una duración menor.</>
              ) : file ? (
                <>
                  Este video usará {durationMinutes} de tus {remaining} min restantes.
                </>
              ) : (
                <>Sube un documento para activar la generación.</>
              )}
            </p>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!file || exhausted || tooLong}
            >
              <Sparkles className="size-4" aria-hidden />
              Generar video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
