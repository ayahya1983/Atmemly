import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";
import { BRAND } from "@workspace/branding";

export function Logo({ collapsed = false }: { collapsed?: boolean } = {}) {
  const { lang } = useTranslation();
  return (
    <Link
      href="/"
      className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity"
      data-testid="link-logo"
    >
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt={BRAND.name}
        className="h-8 w-auto object-contain"
      />
      {!collapsed && (
        <span className="font-extrabold text-lg text-primary leading-none">
          {lang === "ar" ? BRAND.nameAr : BRAND.name}
        </span>
      )}
    </Link>
  );
}
