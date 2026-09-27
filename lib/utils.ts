import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { DocumentType } from "@/types";

/** Merge conditional class names, letting later Tailwind classes win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string) {
  return DATE_FORMATTER.format(new Date(iso));
}

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * For dates defined in UTC, like billing periods. Formatting them in local time
 * turns "1 Oct 00:00 UTC" into "30 Sep" west of Greenwich, which contradicts
 * the "renews on the 1st" rule the student was told.
 */
export function formatUtcDate(iso: string) {
  return UTC_DATE_FORMATTER.format(new Date(iso));
}

/** "hace 3 h" / "ayer" style label used in the sidebar and video cards. */
export function formatRelativeDate(iso: string, now: Date = new Date()) {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;

  return formatDate(iso);
}

/** 185 -> "3:05" */
export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatPrice(price: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

const SUPPORTED_EXTENSIONS: Record<string, DocumentType> = {
  pdf: "pdf",
  docx: "docx",
  doc: "docx",
  txt: "txt",
  md: "txt",
};

export function getDocumentType(fileName: string): DocumentType | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return null;
  return SUPPORTED_EXTENSIONS[extension] ?? null;
}

/** Strip the extension so "Capitulo-3.pdf" becomes a readable video title. */
export function titleFromFileName(fileName: string) {
  const base = fileName.replace(/\.[^./]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Documento sin título";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic pastel pair so every video gets a distinct mock thumbnail. */
export function thumbnailGradient(seed: string) {
  const palettes = [
    ["#eef2ff", "#c7d2fe"],
    ["#ecfdf5", "#bbf7d0"],
    ["#fff7ed", "#fed7aa"],
    ["#fdf2f8", "#fbcfe8"],
    ["#eff6ff", "#bfdbfe"],
    ["#f5f3ff", "#ddd6fe"],
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return palettes[hash % palettes.length];
}
