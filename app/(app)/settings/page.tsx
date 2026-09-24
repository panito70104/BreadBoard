"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { DurationSelector } from "@/components/upload/duration-selector";
import { StyleSelector } from "@/components/upload/style-selector";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { integrations } from "@/lib/config";
import { useAuth } from "@/lib/auth-context";
import type { VideoDurationMinutes, VideoStyle } from "@/types";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();

  /**
   * Draft edits only. Until the user touches a field the values come straight
   * from the session, which loads after the first render.
   */
  const [draft, setDraft] = useState<{ name: string; email: string } | null>(null);
  const name = draft?.name ?? user?.name ?? "";
  const email = draft?.email ?? user?.email ?? "";

  const [defaultStyle, setDefaultStyle] = useState<VideoStyle>("classic-whiteboard");
  const [defaultDuration, setDefaultDuration] = useState<VideoDurationMinutes>(3);
  const [isSaved, setIsSaved] = useState(false);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO(backend): PATCH /users/me with the profile and default preferences.
    updateUser({ name, email });
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 2400);
  }

  return (
    <PageBody>
      <PageHeader title="Settings" description="Tu perfil y tus preferencias de generación." />

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <Card as="section" className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Perfil</h2>

          <div className="mt-5 flex items-center gap-4">
            <Avatar name={name || "Estudiante"} size="lg" />
            <div>
              <Button type="button" variant="outline" size="sm">
                Cambiar foto
              </Button>
              <FieldHint className="mt-1.5">JPG o PNG, hasta 2 MB.</FieldHint>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) =>
                  setDraft({ name: event.target.value, email })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setDraft({ name, email: event.target.value })
                }
              />
            </div>
          </div>
        </Card>

        <Card as="section" className="space-y-6 p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Preferencias de generación
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Lo que preseleccionamos cada vez que subes un documento.
            </p>
          </div>

          <StyleSelector value={defaultStyle} onChange={setDefaultStyle} />
          <DurationSelector value={defaultDuration} onChange={setDefaultDuration} />
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit">Guardar cambios</Button>
          {isSaved && (
            <span className="animate-fade-in flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="size-4" aria-hidden />
              Guardado
            </span>
          )}
        </div>
      </form>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Integraciones</h2>
        <p className="mt-1 text-sm text-slate-600">
          Servicios previstos para la versión conectada. Hoy todo funciona con datos mock.
        </p>

        <ul className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          {integrations.map((integration) => (
            <li
              key={integration.id}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {integration.provider}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{integration.purpose}</p>
                <p className="mt-1 font-mono text-xs text-slate-400">
                  {integration.entryPoint}
                </p>
              </div>
              <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                Pendiente
              </span>
            </li>
          ))}
        </ul>
      </section>
    </PageBody>
  );
}
