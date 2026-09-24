"use client";

import { useState } from "react";
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
  MissingApiKeyError,
  createGenerationJob,
  createGenerationSteps,
  generateVideoFromFile,
  uploadDocument,
} from "@/lib/api";
import { useVideos } from "@/lib/video-store";
import type {
  GenerationStep,
  StudyDocument,
  Video,
  VideoDurationMinutes,
  VideoStyle,
} from "@/types";

type PanelStatus = "idle" | "uploading" | "configuring" | "generating" | "done";

/** Neutral note: something worth knowing that is not an error. */
function NoticeBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/**
 * The full mock flow: drop a file, pick the options, watch the five pipeline
 * steps run, get a video card at the end.
 */
export function GenerationPanel() {
  const { addVideo } = useVideos();

  const [status, setStatus] = useState<PanelStatus>("idle");
  const [uploadedDoc, setUploadedDoc] = useState<StudyDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<VideoStyle>("classic-whiteboard");
  const [durationMinutes, setDurationMinutes] = useState<VideoDurationMinutes>(3);

  const [steps, setSteps] = useState<GenerationStep[]>(createGenerationSteps());
  const [progress, setProgress] = useState(0);
  const [video, setVideo] = useState<Video | null>(null);
  /** Kept so the real generator can send the actual bytes to the server. */
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isBusy = status === "uploading" || status === "generating";

  function reset() {
    setStatus("idle");
    setUploadedDoc(null);
    setPendingFile(null);
    setUploadProgress(0);
    setError(null);
    setPrompt("");
    setSteps(createGenerationSteps());
    setProgress(0);
    setVideo(null);
    setRawFile(null);
    setNotice(null);
  }

  async function handleFileSelected(file: File) {
    setError(null);
    setNotice(null);
    setStatus("uploading");
    setPendingFile({ name: file.name, size: file.size });
    setRawFile(file);
    setUploadProgress(0);

    try {
      const uploaded = await uploadDocument(file, setUploadProgress);
      setUploadedDoc(uploaded);
      setStatus("configuring");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos subir el archivo.");
      setStatus("idle");
      setPendingFile(null);
    }
  }

  async function handleGenerate() {
    if (!uploadedDoc) return;

    setError(null);
    setNotice(null);
    setStatus("generating");
    setProgress(0);
    setSteps(createGenerationSteps());

    const options = {
      prompt: prompt.trim() || undefined,
      style,
      durationMinutes,
    };

    const track = ({ job }: { job: { steps: GenerationStep[]; progress: number } }) => {
      setSteps(job.steps);
      setProgress(job.progress);
    };

    try {
      // The real path reads the document and asks Claude for the storyboard.
      if (rawFile) {
        const result = await generateVideoFromFile(rawFile, options, track);
        setVideo(result.video);
        addVideo(result.video);
        if (result.notice) setNotice(result.notice);
        setStatus("done");
        return;
      }
      throw new MissingApiKeyError();
    } catch (cause) {
      if (!(cause instanceof MissingApiKeyError)) {
        setError(cause instanceof Error ? cause.message : "La generación falló.");
        setStatus("configuring");
        return;
      }

      // No API key configured: fall back to the sample storyboard so the demo
      // still works, but say so plainly instead of pretending Claude ran.
      setNotice(
        "Sin ANTHROPIC_API_KEY: generamos un guion de ejemplo. Añade la clave a .env.local para que Claude lea tu documento de verdad.",
      );
      setSteps(createGenerationSteps());
      setProgress(0);

      const created = await createGenerationJob(
        { documentId: uploadedDoc.id, ...options },
        track,
      );
      setVideo(created);
      addVideo(created);
      setStatus("done");
    }
  }

  if (status === "done" && video) {
    return (
      <div className="space-y-4">
        {notice && <NoticeBanner>{notice}</NoticeBanner>}
        <GeneratedVideoCard video={video} onCreateAnother={reset} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {status === "idle" && (
        <UploadDropzone onFileSelected={handleFileSelected} />
      )}

      {(status === "uploading" || status === "configuring") && pendingFile && (
        <DocumentChip
          name={pendingFile.name}
          sizeBytes={pendingFile.size}
          pageCount={uploadedDoc?.pageCount}
          uploadProgress={status === "uploading" ? uploadProgress : undefined}
          onRemove={status === "configuring" ? reset : undefined}
        />
      )}

      {status === "generating" && <GenerationProgress steps={steps} progress={progress} />}

      {notice && <NoticeBanner>{notice}</NoticeBanner>}

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {status !== "generating" && (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">
              ¿Qué quieres que te expliquen?{" "}
              <span className="font-normal text-slate-400">(opcional)</span>
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isBusy}
              placeholder="Ej: Explícame el capítulo 1 de forma sencilla"
              className="min-h-20"
            />
          </div>

          <StyleSelector value={style} onChange={setStyle} disabled={isBusy} />
          <DurationSelector
            value={durationMinutes}
            onChange={setDurationMinutes}
            disabled={isBusy}
          />

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {uploadedDoc
                ? "Todo listo. Generar tarda unos 2–5 minutos en producción."
                : "Sube un documento para activar la generación."}
            </p>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!uploadedDoc || isBusy}
              isLoading={status === "uploading"}
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
