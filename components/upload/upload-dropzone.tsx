"use client";

import { useRef, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UPLOAD_LIMITS } from "@/lib/config";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onFileSelected,
  disabled = false,
  className,
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        isDragging
          ? "border-brand-400 bg-brand-50"
          : "border-slate-300 bg-white hover:border-slate-400",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="bg-dots absolute inset-0 rounded-2xl opacity-40" aria-hidden />

      <span
        className={cn(
          "relative flex size-14 items-center justify-center rounded-2xl transition-colors",
          isDragging ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
        )}
      >
        {isDragging ? (
          <FileUp className="size-7" aria-hidden />
        ) : (
          <UploadCloud className="size-7" aria-hidden />
        )}
      </span>

      <p className="relative mt-5 text-lg font-medium text-slate-900">
        Arrastra tu PDF, libro o cuaderno aquí
      </p>
      <p className="relative mt-1.5 text-sm text-slate-500">
        o selecciona el archivo desde tu computadora
      </p>

      <Button
        type="button"
        variant="outline"
        className="relative mt-6"
        onClick={() => inputRef.current?.click()}
      >
        Seleccionar archivo
      </Button>

      <p className="relative mt-4 text-xs text-slate-400">
        PDF, DOCX o TXT · hasta 25 MB
      </p>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={UPLOAD_LIMITS.acceptAttribute}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          // Reset so picking the same file twice still fires onChange.
          event.target.value = "";
        }}
      />
    </div>
  );
}
