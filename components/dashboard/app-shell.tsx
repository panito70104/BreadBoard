"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";

import { Sidebar } from "@/components/dashboard/sidebar";
import { Logo } from "@/components/ui/logo";

/** Sidebar + main column. Owns the mobile drawer state. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-paper">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-dvh flex-col lg:pl-[17rem]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <PanelLeft className="size-5" />
          </button>
          <Logo href="/dashboard" />
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
