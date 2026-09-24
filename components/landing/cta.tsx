import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/section";

export function Cta() {
  return (
    <section className="pb-20 sm:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-14 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden
            className="bg-grid absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(70%_70%_at_50%_50%,black,transparent)]"
          />
          <div
            aria-hidden
            className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl"
          />

          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
              Tu próximo examen no se estudia solo.{" "}
              <span className="font-hand text-accent-400">Pero casi.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-pretty text-slate-300">
              Sube un PDF y mira tu primera explicación en video en menos de cinco
              minutos. Gratis, sin tarjeta.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={buttonVariants({
                  size: "lg",
                  className: "bg-white text-slate-900 hover:bg-slate-100",
                })}
              >
                Crear cuenta gratis
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/dashboard"
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className: "text-white hover:bg-white/10 hover:text-white",
                })}
              >
                Explorar el dashboard
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
