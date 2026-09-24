import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VideoStatus } from "@/types";

const STATUS_CONFIG: Record<
  VideoStatus,
  { label: string; tone: BadgeTone; Icon: typeof CheckCircle2; iconClassName?: string }
> = {
  ready: { label: "Ready", tone: "success", Icon: CheckCircle2 },
  generating: {
    label: "Generating",
    tone: "brand",
    Icon: Loader2,
    iconClassName: "animate-spin",
  },
  failed: { label: "Failed", tone: "danger", Icon: CircleAlert },
};

export function StatusBadge({
  status,
  className,
}: {
  status: VideoStatus;
  className?: string;
}) {
  const { label, tone, Icon, iconClassName } = STATUS_CONFIG[status];

  return (
    <Badge tone={tone} className={className}>
      <Icon className={cn("size-3.5", iconClassName)} aria-hidden />
      {label}
    </Badge>
  );
}

/** Compact dot used in the sidebar where a full badge would be too heavy. */
export function StatusDot({
  status,
  className,
}: {
  status: VideoStatus;
  className?: string;
}) {
  const TONE_CLASSES: Record<VideoStatus, string> = {
    ready: "bg-emerald-500",
    generating: "bg-brand-500 animate-pulse",
    failed: "bg-red-500",
  };

  return (
    <span
      title={STATUS_CONFIG[status].label}
      className={cn("inline-block size-2 shrink-0 rounded-full", TONE_CLASSES[status], className)}
    />
  );
}
