import { redirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { AuthProvider } from "@/lib/auth-context";
import { getCurrentUser } from "@/lib/server/auth/dal";
import { toUserDto } from "@/lib/server/dto";
import { usageSummary } from "@/lib/server/services/usage";
import { VideoProvider } from "@/lib/video-store";

/**
 * Every signed-in page goes through here.
 *
 * `proxy.ts` already bounced visitors without a valid token; this is the real
 * check, against the database — a token for a deleted account stops here. The
 * user found is handed to the client providers so the app renders signed-in
 * from the first frame, without a loading flash.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const initialUser = toUserDto(user, await usageSummary(user.id, user.planId));

  return (
    <AuthProvider initialUser={initialUser}>
      <VideoProvider>
        <AppShell>{children}</AppShell>
      </VideoProvider>
    </AuthProvider>
  );
}
