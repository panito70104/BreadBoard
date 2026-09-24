import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The BreadBoardAI mark: a breadboard dot-grid with a marker stroke drawn
 * across it — "board you sketch on" meets "board you plug ideas into".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <g fill="currentColor" opacity="0.5">
          <circle cx="7" cy="7" r="1.1" />
          <circle cx="12" cy="7" r="1.1" />
          <circle cx="17" cy="7" r="1.1" />
          <circle cx="7" cy="12" r="1.1" />
          <circle cx="17" cy="12" r="1.1" />
          <circle cx="7" cy="17" r="1.1" />
          <circle cx="12" cy="17" r="1.1" />
          <circle cx="17" cy="17" r="1.1" />
        </g>
        <path
          d="M4.5 16.5c3-1 4.2-6.2 6.4-6.2 1.8 0 1.4 4.3 3.1 4.3 1.6 0 3-2.4 5.5-6.1"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export interface LogoProps {
  href?: string;
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ href = "/", className, showWordmark = true }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 font-semibold text-slate-900", className)}
    >
      <LogoMark />
      {showWordmark && (
        <span className="text-[17px] tracking-tight">
          BreadBoard<span className="text-brand-600">AI</span>
        </span>
      )}
    </Link>
  );
}
