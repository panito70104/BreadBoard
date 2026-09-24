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

/** "maria.lopez@uni.edu" -> "Maria Lopez", so a login has a name to show. */
export function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || "Estudiante";
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Stable-enough id generator for mock records created in the browser. */
export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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
