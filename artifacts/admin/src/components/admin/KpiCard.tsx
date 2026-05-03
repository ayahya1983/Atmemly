import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  delta?: { value: number; label?: string };
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const TONE_BG: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
};

export function KpiCard({ label, value, icon: Icon, hint, delta, tone = "default", className }: KpiCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
            {delta && (
              <p className={cn(
                "text-xs mt-2 font-medium",
                delta.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}>
                {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value).toFixed(1)}% {delta.label ?? ""}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", TONE_BG[tone])}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
