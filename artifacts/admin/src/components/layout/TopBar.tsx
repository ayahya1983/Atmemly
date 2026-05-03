import { Search, Bell, Sun, Moon, Languages, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useThemeStore } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { effectiveAdminRole, ADMIN_ROLE_LABELS } from "@/lib/permissions";

export function TopBar() {
  const { lang, setLang } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { user, logout } = useAuth();
  const role = effectiveAdminRole(user);

  const initial = user?.fullName?.[0] ?? "?";

  return (
    <header className="h-16 px-4 md:px-6 flex items-center gap-3 border-b border-border bg-background sticky top-0 z-30">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder={lang === "ar" ? "بحث سريع..." : "Quick search..."}
            className="ltr:pl-9 rtl:pr-9 h-10 bg-muted/40 border-muted"
            data-testid="input-global-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          aria-label="Toggle language"
          data-testid="button-lang-toggle"
        >
          <Languages className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 ltr:right-1.5 rtl:left-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{lang === "ar" ? "الإشعارات" : "Notifications"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="py-8 text-center text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد إشعارات جديدة" : "No new notifications"}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 ltr:pl-1 ltr:pr-2 rtl:pr-1 rtl:pl-2 h-10 rounded-md hover-elevate"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.fullName ?? ""} />
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start leading-tight">
                <span className="text-sm font-medium truncate max-w-[140px]">{user?.fullName}</span>
                {role && (
                  <span className="text-[10px] text-muted-foreground">
                    {ADMIN_ROLE_LABELS[role][lang]}
                  </span>
                )}
              </div>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span className="font-medium">{user?.fullName}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
              {role && (
                <Badge variant="outline" className="self-start mt-1 text-[10px]">
                  {ADMIN_ROLE_LABELS[role][lang]}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { window.location.href = "/"; }}>
              <UserIcon className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
              {lang === "ar" ? "العودة للموقع" : "Back to marketplace"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
              {lang === "ar" ? "تسجيل الخروج" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
