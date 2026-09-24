"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus, X } from "lucide-react";

import { SidebarVideoItem } from "@/components/dashboard/sidebar-video-item";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardNav } from "@/data/navigation";
import { useAuth } from "@/lib/auth-context";
import { useVideos } from "@/lib/video-store";
import { cn } from "@/lib/utils";

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  const { videos, isLoading: areVideosLoading } = useVideos();

  const usageRatio =
    user && user.minutesLimit > 0 ? (user.minutesUsed / user.minutesLimit) * 100 : 0;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-slate-200 bg-slate-50/80 transition-transform duration-200 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Logo href="/dashboard" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={buttonVariants({ className: "w-full" })}
          >
            <Plus className="size-4" aria-hidden />
            Nuevo video
          </Link>
        </div>

        <nav className="px-3">
          <ul className="space-y-0.5">
            {dashboardNav.map(({ label, href, Icon }) => {
              const isActive =
                pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-white text-brand-700 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
          <p className="px-2.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Tus videos
          </p>

          <div className="scrollbar-slim mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-4">
            {areVideosLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-2.5 px-2.5 py-2">
                  <Skeleton className="mt-1.5 size-2 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            ) : videos.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-slate-500">
                Aún no tienes videos. Sube un documento para generar el primero.
              </p>
            ) : (
              videos.map((video) => (
                <SidebarVideoItem
                  key={video.id}
                  video={video}
                  isActive={pathname === `/videos/${video.id}`}
                  onNavigate={onClose}
                />
              ))
            )}
          </div>
        </div>

        {!user && !isLoading && (
          <div className="shrink-0 border-t border-slate-200 p-3">
            <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200">
              <p className="text-xs text-slate-600">
                Inicia sesión para guardar tus videos y ver tu consumo.
              </p>
              <Link
                href="/login"
                onClick={onClose}
                className={buttonVariants({ size: "sm", className: "mt-3 w-full" })}
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        )}

        {user && (
          <div className="shrink-0 border-t border-slate-200 p-3">
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Plan {user.planId}</span>
                <span className="text-slate-500">
                  {user.minutesUsed}/{user.minutesLimit} min
                </span>
              </div>
              <Progress value={usageRatio} className="mt-2 h-1.5" label="Uso mensual" />
              <Link
                href="/billing"
                onClick={onClose}
                className="mt-2.5 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Subir de plan
              </Link>
            </div>

            <div className="mt-3 flex items-center gap-2.5 px-1">
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Cerrar sesión"
                className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
