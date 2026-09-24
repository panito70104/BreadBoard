import { FileText, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import type { StudyDocument } from "@/types";

/** File currently attached to the generation form. */
export function DocumentChip({
  name,
  sizeBytes,
  pageCount,
  uploadProgress,
  onRemove,
}: {
  name: string;
  sizeBytes: number;
  pageCount?: StudyDocument["pageCount"];
  /** 0–100 while uploading; omit once the upload finished. */
  uploadProgress?: number;
  onRemove?: () => void;
}) {
  const isUploading = uploadProgress !== undefined && uploadProgress < 100;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <FileText className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatBytes(sizeBytes)}
          {pageCount ? ` · ${pageCount} páginas` : ""}
          {isUploading ? " · subiendo…" : ""}
        </p>
        {isUploading && <Progress value={uploadProgress} className="mt-2 h-1" />}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar archivo"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
