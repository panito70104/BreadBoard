"use client";

/**
 * The signed-in user's videos, shared by the sidebar, the dashboard and the
 * detail page.
 *
 * Generation runs on the server after the upload request returns, so while
 * any video is generating the store polls and the UI advances on its own —
 * the student can leave the dashboard and come back to a finished video.
 * When a video finishes, the user is refreshed too: a failure refunds minutes
 * and the meter should show it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Video } from "@/types";

const POLL_INTERVAL_MS = 2500;

interface VideoStoreValue {
  videos: Video[];
  isLoading: boolean;
  error: string | null;
  addVideo: (video: Video) => void;
  updateVideo: (id: string, patch: Partial<Video>) => void;
  removeVideo: (id: string) => Promise<void>;
  getVideo: (id: string) => Video | undefined;
  refresh: () => Promise<void>;
}

const VideoStoreContext = createContext<VideoStoreValue | null>(null);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const { refresh: refreshUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generatingIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const next = await api.getVideos();
      setError(null);
      setVideos(next);

      // Something that was generating just finished: minutes may have moved.
      const stillGenerating = new Set(
        next.filter((video) => video.status === "generating").map((video) => video.id),
      );
      const finished = [...generatingIds.current].some((id) => !stillGenerating.has(id));
      generatingIds.current = stillGenerating;
      if (finished) void refreshUser();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cargar tus videos.");
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    api
      .getVideos()
      .then((initial) => {
        if (cancelled) return;
        setVideos(initial);
        generatingIds.current = new Set(
          initial.filter((video) => video.status === "generating").map((video) => video.id),
        );
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "No pudimos cargar tus videos.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll only while something is in flight.
  const anyGenerating = videos.some((video) => video.status === "generating");
  useEffect(() => {
    if (!anyGenerating) return;
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [anyGenerating, refresh]);

  const addVideo = useCallback((video: Video) => {
    if (video.status === "generating") generatingIds.current.add(video.id);
    setVideos((current) => [video, ...current.filter((item) => item.id !== video.id)]);
  }, []);

  const updateVideo = useCallback((id: string, patch: Partial<Video>) => {
    setVideos((current) =>
      current.map((video) => (video.id === id ? { ...video, ...patch } : video)),
    );
  }, []);

  const removeVideo = useCallback(async (id: string) => {
    await api.deleteVideo(id);
    setVideos((current) => current.filter((video) => video.id !== id));
  }, []);

  const getVideo = useCallback(
    (id: string) => videos.find((video) => video.id === id),
    [videos],
  );

  const value = useMemo<VideoStoreValue>(
    () => ({ videos, isLoading, error, addVideo, updateVideo, removeVideo, getVideo, refresh }),
    [videos, isLoading, error, addVideo, updateVideo, removeVideo, getVideo, refresh],
  );

  return <VideoStoreContext.Provider value={value}>{children}</VideoStoreContext.Provider>;
}

export function useVideos() {
  const context = useContext(VideoStoreContext);
  if (!context) {
    throw new Error("useVideos debe usarse dentro de <VideoProvider>.");
  }
  return context;
}
