"use client";

import { AuthProvider } from "@/lib/auth-context";
import { VideoProvider } from "@/lib/video-store";

/** Single mount point for every client-side provider the app needs. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <VideoProvider>{children}</VideoProvider>
    </AuthProvider>
  );
}
