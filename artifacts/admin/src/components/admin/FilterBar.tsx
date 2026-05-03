import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onReset?: () => void;
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  onReset,
  children,
  className,
}: FilterBarProps) {
  const { lang } = useTranslation();
  const hasFilters = !!(search || children);
  return (
    <div className={cn("flex flex-wrap items-center gap-2 py-2", className)}>
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? (lang === "ar" ? "بحث..." : "Search...")}
            className="ltr:pl-9 rtl:pr-9"
            data-testid="input-filter-search"
          />
        </div>
      )}
      {children}
      {hasFilters && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} data-testid="button-reset-filters">
          <X className="w-4 h-4 ltr:mr-1 rtl:ml-1" />
          {lang === "ar" ? "تصفية" : "Reset"}
        </Button>
      )}
    </div>
  );
}
