import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Bienvenida de nuevo"
      subtitle="Entra para seguir estudiando con tus videos."
      footer={
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Crear cuenta
          </Link>
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
