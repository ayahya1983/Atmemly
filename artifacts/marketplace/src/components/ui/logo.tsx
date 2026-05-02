import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";

export function Logo() {
  const { isRtl } = useTranslation();
  return (
    <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight no-underline hover:opacity-90 transition-opacity">
      <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
        <span className="font-sans font-bold leading-none">{isRtl ? "خ" : "K"}</span>
      </div>
      <span className="font-sans">{isRtl ? "خدمة" : "Khidma"}</span>
    </Link>
  );
}
