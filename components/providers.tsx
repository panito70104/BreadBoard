"use client";

import { AuthProvider } from "@/lib/auth-context";

/**
 * Providers for every page. The video store lives in the app layout instead:
 * it needs a signed-in user, and public pages should not fetch videos.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
