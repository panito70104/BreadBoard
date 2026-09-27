"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signup(form);
      // refresh() drops the router cache so the app layout renders against
      // the new session cookie instead of anything cached while signed out.
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos crear tu cuenta.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Tu nombre"
          value={form.name}
          onChange={update("name")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@universidad.edu"
          value={form.email}
          onChange={update("email")}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={form.password}
          onChange={update("password")}
          required
        />
        <FieldHint>Mínimo 8 caracteres.</FieldHint>
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" isLoading={isSubmitting}>
        {isSubmitting ? "Creando cuenta…" : "Crear cuenta gratis"}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Empiezas en el plan Free con 3 minutos de video al mes. Sin tarjeta.
      </p>
    </form>
  );
}
