import { AppShell } from "@/components/dashboard/app-shell";

/**
 * Layout for every signed-in route.
 *
 * TODO(auth): once real auth exists, read the session here and
 * `redirect("/login")` when it is missing.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
