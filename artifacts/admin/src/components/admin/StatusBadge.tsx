import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-foreground border-border",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  muted: "bg-muted/50 text-muted-foreground border-border",
};

const STATUS_TONE: Record<string, Tone> = {
  active: "success", approved: "success", paid: "success", completed: "success",
  released: "success", processed: "success", verified: "success", published: "success",
  open: "info", in_progress: "info", in_review: "info", submitted: "info", pending: "warning",
  pending_review: "warning", awaiting_payment: "warning", review: "warning", on_hold: "warning",
  draft: "muted", inactive: "muted", archived: "muted", closed: "muted",
  rejected: "danger", suspended: "danger", banned: "danger", failed: "danger",
  refunded: "danger", cancelled: "danger", canceled: "danger", disputed: "danger",
  not_submitted: "muted",
};

export function statusTone(status: string | null | undefined): Tone {
  if (!status) return "muted";
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string | null | undefined;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? statusTone(status);
  return (
    <Badge
      variant="outline"
      className={cn("font-medium capitalize border", TONE_CLASSES[t], className)}
    >
      {(status ?? "—").replace(/_/g, " ")}
    </Badge>
  );
}
