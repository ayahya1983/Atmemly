import { useTranslation } from "@/lib/i18n";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  const { lang } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-foreground" data-testid="logo">
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Atmemly"
        className="h-9 w-auto shrink-0 object-contain"
      />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-sans text-foreground font-extrabold text-base">
            {lang === "ar" ? "أتمملي" : "Atmemly"}
          </div>
          <div className="text-[10px] tracking-[0.2em] text-muted-foreground font-medium uppercase">
            {lang === "ar" ? "لوحة الإدارة" : "Admin Panel"}
          </div>
        </div>
      )}
    </div>
  );
}
