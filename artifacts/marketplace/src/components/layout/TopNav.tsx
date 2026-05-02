import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { Logo } from "../ui/logo";
import { Button } from "../ui/button";
import { Menu, Bell, LogIn, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { useState } from "react";
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function TopNav() {
  const { t, lang, setLang, currency, setCurrency, isRtl } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications } = useListNotifications({
    query: { enabled: !!user, refetchInterval: 10000, queryKey: getListNotificationsQueryKey() },
  });

  const markRead = useMarkAllNotificationsRead();
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const handleMarkAllRead = () => {
    if (unreadCount > 0) {
      markRead.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
      });
    }
  };

  // In RTL we render the array right-to-left visually; logical order is the same.
  const navLinks = [
    { href: "/jobs?tab=services", label: t("nav.services") },
    { href: "/jobs", label: t("nav.projects") },
    { href: "/freelancers?tab=works", label: t("nav.works") },
    { href: "/freelancers", label: t("nav.freelancers") },
    { href: "/about", label: t("nav.community") },
    { href: "/blog", label: t("nav.blog") },
    { href: "/contact", label: t("nav.help") },
  ];

  const getDashboardLink = () => {
    if (!user) return "/login";
    if (user.role === "admin") return "/admin";
    if (user.role === "client") return "/dashboard/client";
    return "/dashboard/freelancer";
  };

  const isActive = (href: string) => {
    const path = href.split("?")[0]!;
    return location === path || (path !== "/" && location.startsWith(path));
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
      data-testid="top-nav"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Right side in RTL: logo. Left side in LTR: logo. */}
        <Logo />

        {/* Center: nav links (desktop) */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-7 flex-1 justify-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[15px] font-medium transition-colors hover:text-primary whitespace-nowrap ${
                isActive(link.href) ? "text-primary" : "text-foreground/80"
              }`}
              data-testid={`nav-link-${link.href}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Lang/Currency + auth */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 font-medium text-sm border border-border/60"
                data-testid="button-lang-currency"
              >
                <span className="font-bold">{lang === "ar" ? "AR" : "EN"}</span>
                <span className="text-muted-foreground">·</span>
                <span>{currency === "AED" ? "د.إ" : "$"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRtl ? "start" : "end"} className="w-44">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {isRtl ? "اللغة" : "Language"}
              </div>
              <DropdownMenuItem onClick={() => setLang("ar")} className={lang === "ar" ? "bg-accent" : ""}>
                العربية
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang("en")} className={lang === "en" ? "bg-accent" : ""}>
                English
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {isRtl ? "العملة" : "Currency"}
              </div>
              <DropdownMenuItem onClick={() => setCurrency("AED")} className={currency === "AED" ? "bg-accent" : ""}>
                AED — {isRtl ? "درهم إماراتي" : "UAE Dirham"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrency("USD")} className={currency === "USD" ? "bg-accent" : ""}>
                USD — {isRtl ? "دولار أمريكي" : "US Dollar"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <div className="flex items-center gap-2">
              <Popover onOpenChange={(open) => { if (open) handleMarkAllRead(); }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative rounded-full" data-testid="button-notifications">
                    <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align={isRtl ? "start" : "end"} className="w-80 p-0">
                  <div className="p-4 border-b font-semibold">
                    {isRtl ? "الإشعارات" : "Notifications"}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications?.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {isRtl ? "لا توجد إشعارات" : "No notifications"}
                      </div>
                    ) : (
                      notifications?.map((n) => (
                        <div key={n.id} className={`p-4 border-b last:border-b-0 text-sm ${!n.read ? "bg-muted/30" : ""}`}>
                          <div className="font-medium mb-1">{n.title}</div>
                          <div className="text-muted-foreground mb-2">{n.body}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.createdAt))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Link href={getDashboardLink()}>
                <Button variant="outline" size="sm" data-testid="button-dashboard">
                  {t("nav.dashboard")}
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0" data-testid="button-user-menu">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRtl ? "start" : "end"}>
                  <DropdownMenuItem className="font-medium">{user.fullName}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-login">
                  <LogIn className="w-4 h-4" />
                  {t("nav.login")}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="gap-2" data-testid="button-register">
                  <UserPlus className="w-4 h-4" />
                  {t("nav.register")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile */}
        <div className="lg:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="text-xs font-bold"
          >
            {lang === "en" ? "AR" : "EN"}
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? "right" : "left"} className="flex flex-col gap-6 pt-12">
              <Logo />
              <div className="flex flex-col gap-1 mt-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`text-base font-medium py-2 ${
                      isActive(link.href) ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="h-px bg-border my-4" />
                {user ? (
                  <>
                    <Link href={getDashboardLink()} onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full justify-start">{t("nav.dashboard")}</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive"
                      onClick={() => { logout(); setMobileOpen(false); }}
                    >
                      {t("nav.logout")}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full">{t("nav.login")}</Button>
                    </Link>
                    <Link href="/register" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full">{t("nav.register")}</Button>
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
