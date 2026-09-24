import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { Container } from "@/components/ui/section";
import { footerColumns } from "@/data/landing";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-slate-600">
              Convierte tus PDFs, libros y apuntes en videos whiteboard para estudiar
              más fácil.
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} BreadBoardAI. Todos los derechos reservados.
          </p>
          <p className="text-xs text-slate-400">
            Versión demo · datos de ejemplo, sin backend conectado.
          </p>
        </div>
      </Container>
    </footer>
  );
}
