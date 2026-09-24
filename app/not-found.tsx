import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="font-hand mt-10 text-7xl text-slate-300">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Esta página no existe
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-600">
        Puede que el enlace esté mal escrito o que el contenido se haya movido.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link href="/" className={buttonVariants()}>
          Volver al inicio
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Ir al dashboard
        </Link>
      </div>
    </main>
  );
}
