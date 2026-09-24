import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recupera tu contraseña"
      subtitle="Te enviamos un enlace para crear una nueva."
      footer={
        <p>
          ¿La recordaste?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Volver al login
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
