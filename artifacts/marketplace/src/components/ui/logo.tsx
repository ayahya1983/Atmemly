import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";

export function Logo() {
  const { isRtl } = useTranslation();
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight no-underline hover:opacity-90 transition-opacity"
      data-testid="link-logo"
    >
      <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm shrink-0">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <div className="leading-none">
        <div className="font-sans text-primary font-extrabold text-xl">
          {isRtl ? "أتمملي" : "ATMEMLY"}
        </div>
        <div className="text-[10px] tracking-[0.2em] text-muted-foreground font-medium">
          {isRtl ? "ATMEMLY" : "أتمملي"}
        </div>
      </div>
    </Link>
  );
}
