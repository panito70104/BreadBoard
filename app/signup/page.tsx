import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Sube tu primer PDF y mira cómo se explica solo."
      footer={
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Iniciar sesión
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
