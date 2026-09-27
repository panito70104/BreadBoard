"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { requestPasswordReset } from "@/lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setIsSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos enviar el correo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
        <MailCheck className="size-6 text-emerald-600" aria-hidden />
        <p className="mt-3 text-sm font-medium text-emerald-900">Revisa tu correo</p>
        <p className="mt-1 text-sm text-emerald-800">
          Si <span className="font-medium">{email}</span> tiene una cuenta, le enviamos un
          enlace para restablecer la contraseña.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@universidad.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
        Enviar enlace de recuperación
      </Button>
    </form>
  );
}
