import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Logo } from "@/components/ui/logo";

const HIGHLIGHTS = [
  "Sube un PDF y recibe una explicación en video",
  "Storyboard por escenas: intro, concepto, ejemplo y resumen",
  "Tu biblioteca de repaso, siempre a mano",
];

/**
 * Split layout shared by login, signup and password recovery so the three
 * screens stay visually identical.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-sm text-slate-600">{footer}</div>}
        </div>

        <p className="text-center text-xs text-slate-400">
          Tus documentos son privados: solo tú puedes ver lo que subes.
        </p>
      </div>

      {/* Brand side */}
      <aside className="relative hidden w-[46%] max-w-2xl overflow-hidden bg-slate-900 lg:block">
        <div className="bg-grid absolute inset-0 opacity-[0.08]" aria-hidden />
        <div
          aria-hidden
          className="absolute -top-20 -right-20 size-96 rounded-full bg-brand-500/30 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
            <Sparkles className="size-3.5" aria-hidden />
            BreadBoardAI para estudiantes
          </span>

          <p className="mt-8 text-3xl leading-tight font-semibold text-balance text-white">
            Deja de releer.{" "}
            <span className="font-hand text-accent-400">Empieza a entender.</span>
          </p>

          <ul className="mt-10 space-y-4">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden />
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
