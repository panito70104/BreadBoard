import Link from "next/link";
import { ArrowRight, FileText, Play, Sparkles } from "lucide-react";

import { WhiteboardPreview } from "@/components/landing/whiteboard-preview";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

const TRUST_POINTS = [
  "Sin tarjeta de crédito",
  "3 minutos gratis al mes",
  "PDF, DOCX y TXT",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="bg-dots absolute inset-0 -z-20 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 -top-40 -z-10 h-96 bg-[radial-gradient(45%_60%_at_50%_50%,rgba(99,102,241,0.14),transparent_70%)]"
      />

      <Container className="grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-28">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
            <Sparkles className="size-3.5" aria-hidden />
            Tu material de clase, explicado en video
          </span>

          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-[3.4rem]">
            Convierte tus PDFs y apuntes en{" "}
            <span className="marker-underline">
              <span className="marker-underline-bar" aria-hidden />
              <span className="relative">videos whiteboard</span>
            </span>{" "}
            para estudiar más fácil
          </h1>

          <p className="mt-6 max-w-xl text-lg text-pretty text-slate-600">
            Sube el capítulo que te toca estudiar y recibe un video con dibujos, una
            mano que escribe y una voz que te explica el tema paso a paso. Como si un
            buen profesor te lo resumiera en la pizarra.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Subir mi primer PDF
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="#como-funciona"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Play className="size-4" aria-hidden />
              Ver cómo funciona
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm text-slate-500">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-sm sm:max-w-md">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <FileText className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-slate-600">
              Empieza con{" "}
              <span className="font-medium text-slate-900">3 minutos de video</span>{" "}
              gratis al mes. Pagas por minuto explicado, no por archivo subido.
            </p>
          </div>
        </div>

        <div className="animate-fade-up lg:pl-4" style={{ animationDelay: "120ms" }}>
          <WhiteboardPreview />
        </div>
      </Container>
    </section>
  );
}
