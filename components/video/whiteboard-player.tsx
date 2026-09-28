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

import { useEffect, useMemo, useRef, useState } from "react";
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

  /**
   * These have to keep their identity between renders.
   *
   * This component re-renders on every `frameupdate` — that is what moves the
   * scrubber — and `inputProps` is handed straight to the composition, whose
   * plan is memoized on the storyboard object. A fresh object per frame
   * invalidates that memo, so the whole storyboard was being re-planned (all
   * scenes, twice) thirty times a second. The frame loop then cannot keep up,
   * the composition's clock falls behind the audio element, and Remotion pulls
   * the audio back into place — which replays the second before, and you hear
   * the last word of the sentence twice.
   *
   * So they are keyed on the video's *content*, not on the object holding it —
   * because the object identity is not stable either. While any generation is
   * in flight the video store re-fetches every 2.5s and replaces every video
   * with a structurally identical copy, which keyed on `video` would throw the
   * plan away and rebuild it mid-playback every few seconds: the same stall,
   * just rarer, and one re-sync of the audio is already one word said twice.
   * Stringifying this on each poll is nothing next to re-planning.
   */
  const signature = useMemo(
    () =>
      JSON.stringify([
        video.title,
        video.language,
        video.durationSeconds,
        video.style,
        video.storyboard,
        video.audioUrls,
      ]),
    [video],
  );

  const inputProps = useMemo(
    () => ({ storyboard: toStoryboard(video), style: video.style, audioUrls: video.audioUrls }),
    // `video` is read through `signature` on purpose — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
  const durationInFrames = useMemo(
    () => Math.max(1, storyboardDurationInFrames(inputProps.storyboard)),
    [inputProps],
  );
  const { fps } = BOARD_DIMENSIONS;

  /**
   * And the Player itself is held as an element, not re-created.
   * Stable props are not enough: re-rendering `<Player>` once per frame costs
   * far more than the scrubber it is paying for. Reusing the same element lets
   * React skip the subtree entirely.
   */
  const surface = useMemo(
    () => (
      <Player
        ref={playerRef}
        component={WhiteboardComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={BOARD_DIMENSIONS.width}
        compositionHeight={BOARD_DIMENSIONS.height}
        style={{ width: "100%", height: "100%" }}
        acknowledgeRemotionLicense
        clickToPlay={false}
        doubleClickToFullscreen
        /*
          One dedicated audio element per scene, instead of Remotion's pool.
          The pool (five tags, the v4 default) exists to dodge mobile autoplay
          rules by pre-mounting silent tags and then swapping their `src` as
          scenes come and go. Playback here always starts from the button
          below, so there is always a user gesture and nothing to dodge — and
          the swapping is not free: assigning `src` reloads the element and
          resets its clock, so a scene can begin on a tag that is still holding
          the previous sentence. Remotion made 0 the default in v5 for this
          reason.
        */
        numberOfSharedAudioTags={0}
      />
    ),
    [inputProps, durationInFrames, fps],
  );

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
        {surface}

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
