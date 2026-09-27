"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert } from "lucide-react";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { StyleSelector } from "@/components/upload/style-selector";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { getServiceStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { ServiceStatus, VideoStyle } from "@/types";

type IntegrationState = "active" | "example" | "pending";

const STATE_LABEL: Record<IntegrationState, string> = {
  active: "Activo",
  example: "Modo ejemplo",
  pending: "Pendiente",
};

const STATE_CLASS: Record<IntegrationState, string> = {
  active: "bg-emerald-50 text-emerald-700",
  example: "bg-amber-50 text-amber-800",
  pending: "bg-slate-100 text-slate-500",
};

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();

  /** Draft edits only; untouched fields read straight from the account. */
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftStyle, setDraftStyle] = useState<VideoStyle | null>(null);

  const name = draftName ?? user?.name ?? "";
  const style = draftStyle ?? user?.preferences?.defaultStyle ?? "classic-whiteboard";

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getServiceStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = draftName !== null || draftStyle !== null;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await updateProfile({
        ...(draftName !== null && { name: draftName }),
        ...(draftStyle !== null && { defaultStyle: draftStyle }),
      });
      setDraftName(null);
      setDraftStyle(null);
        setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  }

  const integrations: Array<{ name: string; purpose: string; state: IntegrationState }> = [
    {
      name: "Base de datos (Postgres)",
      purpose: "Cuentas, videos, documentos y consumo de minutos.",
      state: "active",
    },
    {
      name: "Almacenamiento (S3)",
      purpose: "Tus documentos originales, privados y cifrados en tránsito.",
      state: "active",
    },
    {
      name: "Claude (Anthropic)",
      purpose: "Lee tu documento y escribe el guion escena por escena.",
      state:
        status === null ? "pending" : status.storyboardProvider === "claude" ? "active" : "example",
    },
    {
      name: "Voz (ElevenLabs)",
      purpose: "Narración en audio de cada escena.",
      state: "pending",
    },
    {
      name: "Exportar a MP4 (Remotion)",
      purpose: "Descargar el video como archivo.",
      state: "pending",
    },
    {
      name: "Pagos (Recurrente)",
      purpose: "Cobro de los planes Student y Pro.",
      state: "pending",
    },
  ];

  return (
    <PageBody>
      <PageHeader title="Settings" description="Tu perfil y tus preferencias de generación." />

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <Card as="section" className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Perfil</h2>

          <div className="mt-5 flex items-center gap-4">
            <Avatar name={name || "Estudiante"} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{name}</p>
              <p className="truncate text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                maxLength={80}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" value={user?.email ?? ""} disabled />
              <FieldHint>El correo no se puede cambiar por ahora.</FieldHint>
            </div>
          </div>
        </Card>

        <Card as="section" className="space-y-6 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Preferencias de generación</h2>
            <p className="mt-1 text-sm text-slate-600">
              Lo que preseleccionamos cada vez que subes un documento.
            </p>
          </div>

          <StyleSelector value={style} onChange={setDraftStyle} />
        </Card>

        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!isDirty} isLoading={isSaving}>
            Guardar cambios
          </Button>
          {saved && (
            <span className="animate-fade-in flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="size-4" aria-hidden />
              Guardado
            </span>
          )}
        </div>
      </form>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Integraciones</h2>
        <p className="mt-1 text-sm text-slate-600">Qué servicios están conectados ahora mismo.</p>

        <ul className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {integrations.map((integration) => (
            <li
              key={integration.name}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{integration.name}</p>
                <p className="mt-0.5 text-sm text-slate-600">{integration.purpose}</p>
              </div>
              <span
                className={cn(
                  "w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATE_CLASS[integration.state],
                )}
              >
                {STATE_LABEL[integration.state]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </PageBody>
  );
}
