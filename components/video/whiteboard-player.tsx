"use client";

/**
 * The real player: the storyboard rendered by Remotion in the browser.
 *
 * `@remotion/player` runs the same composition a server-side render would, so
 * what you see here is what an MP4 would contain. No file, no encoding, no
 * backend — the video is the storyboard plus the engine.
 *
 * TODO(render): the same `WhiteboardComposition` goes to Remotion Lambda (or a
 * worker) to produce a downloadable MP4; this component then plays that file
 * instead, with the preview as the fallback while the render is queued.
 */

import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Maximize2, Pause, Play, Volume2 } from "lucide-react";

import {
  BOARD_DIMENSIONS,
  WhiteboardComposition,
  storyboardDurationInFrames,
} from "@/components/engine/whiteboard-composition";
import { cn, formatDuration } from "@/lib/utils";
import type { Storyboard } from "@/types/storyboard";
import type { Video } from "@/types";

function toStoryboard(video: Video): Storyboard {
  return {
    videoTitle: video.title,
    language: video.language ?? "es",
    // The length it was written for; the player only needs what it became.
    targetSeconds: video.durationSeconds,
    scenes: video.storyboard,
    totalSeconds: video.storyboard.reduce(
      (total, scene) => total + scene.durationSeconds,
      0,
    ),
  };
}

export function WhiteboardPlayer({ video }: { video: Video }) {
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  // The Player reports progress through listeners, not props.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrame = (event: { detail: { frame: number } }) =>
      setFrame(event.detail.frame);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);

    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
    };
  }, []);

  const storyboard = toStoryboard(video);
  const durationInFrames = Math.max(1, storyboardDurationInFrames(storyboard));
  const { fps } = BOARD_DIMENSIONS;

  if (video.storyboard.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Este video no tiene storyboard que dibujar.
      </div>
    );
  }

  const toggle = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const seek = (value: number) => {
    playerRef.current?.seekTo(value);
    setFrame(value);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
      <div className="relative aspect-video w-full bg-white">
        <Player
          ref={playerRef}
          component={WhiteboardComposition}
          inputProps={{ storyboard, style: video.style, audioUrls: video.audioUrls }}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={BOARD_DIMENSIONS.width}
          compositionHeight={BOARD_DIMENSIONS.height}
          style={{ width: "100%", height: "100%" }}
          acknowledgeRemotionLicense
          clickToPlay={false}
          doubleClickToFullscreen
        />

        {!isPlaying && frame === 0 && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Reproducir"
            className="absolute inset-0 flex items-center justify-center bg-slate-900/5 transition-colors hover:bg-slate-900/10"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg transition-transform hover:scale-105">
              <Play className="size-7 fill-current" aria-hidden />
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-white transition-colors",
            isPlaying ? "bg-slate-900 hover:bg-slate-800" : "bg-brand-600 hover:bg-brand-700",
          )}
        >
          {isPlaying ? (
            <Pause className="size-4 fill-current" aria-hidden />
          ) : (
            <Play className="size-4 fill-current" aria-hidden />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={durationInFrames - 1}
          value={frame}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Línea de tiempo"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-brand-600"
          style={{
            background: `linear-gradient(to right, #4f46e5 ${
              (frame / Math.max(1, durationInFrames - 1)) * 100
            }%, #e2e8f0 ${(frame / Math.max(1, durationInFrames - 1)) * 100}%)`,
          }}
        />

        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {formatDuration(frame / fps)} / {formatDuration(durationInFrames / fps)}
        </span>

        <Volume2 className="size-4 shrink-0 text-slate-300" aria-hidden />
        <Maximize2 className="size-4 shrink-0 text-slate-400" aria-hidden />
      </div>
    </div>
  );
}
