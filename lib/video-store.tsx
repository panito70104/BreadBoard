"use client";

/**
 * Client-side video store.
 *
 * Holds the list the sidebar, the dashboard and the detail page all read from,
 * so a video generated in one place shows up everywhere immediately.
 *
 * TODO(backend): swap for SWR/React Query against the real endpoints — the
 * hook signature (`videos`, `isLoading`, `addVideo`, ...) can stay the same.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as api from "@/lib/api";
import type { Video } from "@/types";

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
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Initial load. State is only touched from the promise callbacks. */
  useEffect(() => {
    let cancelled = false;

    api
      .getVideos()
      .then((result) => {
        if (!cancelled) setVideos(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "No pudimos cargar tus videos.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Manual refetch, e.g. after an action that invalidates the list. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setVideos(await api.getVideos());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cargar tus videos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addVideo = useCallback((video: Video) => {
    setVideos((current) => [video, ...current.filter((item) => item.id !== video.id)]);
  }, []);

  const updateVideo = useCallback((id: string, patch: Partial<Video>) => {
    setVideos((current) =>
      current.map((video) => (video.id === id ? { ...video, ...patch } : video)),
    );
  }, []);

  const removeVideo = useCallback(async (id: string) => {
    setVideos((current) => current.filter((video) => video.id !== id));
    await api.deleteVideo(id);
  }, []);

  const getVideo = useCallback(
    (id: string) => videos.find((video) => video.id === id),
    [videos],
  );

  const value = useMemo<VideoStoreValue>(
    () => ({ videos, isLoading, error, addVideo, updateVideo, removeVideo, getVideo, refresh }),
    [videos, isLoading, error, addVideo, updateVideo, removeVideo, getVideo, refresh],
  );

  return (
    <VideoStoreContext.Provider value={value}>{children}</VideoStoreContext.Provider>
  );
}

export function useVideos() {
  const context = useContext(VideoStoreContext);
  if (!context) {
    throw new Error("useVideos debe usarse dentro de <VideoProvider>.");
  }
  return context;
}
