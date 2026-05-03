import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard, Users, UserCog, Briefcase, FileText, CreditCard, Wallet,
  Star, AlertTriangle, ShieldCheck, FileEdit, Layers, BookOpen, HelpCircle,
  MessageSquareQuote, Ban, Megaphone, History, Settings, BarChart3, ScrollText,
  ChevronDown, ChevronLeft, ChevronRight,
  KeyRound, ListChecks, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, effectiveAdminRole, type Resource } from "@/lib/permissions";
import { Logo } from "@/components/ui/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: { ar: string; en: string };
  icon: LucideIcon;
  resource: Resource;
  /** Hide this item unless the viewer's effective admin role is super_admin. */
  requireSuperAdmin?: boolean;
}

interface NavGroup {
  key: string;
  label: { ar: string; en: string };
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    label: { ar: "نظرة عامة", en: "Overview" },
    items: [
      { href: "/", label: { ar: "لوحة التحكم", en: "Dashboard" }, icon: LayoutDashboard, resource: "dashboard" },
      { href: "/analytics", label: { ar: "التحليلات", en: "Analytics" }, icon: BarChart3, resource: "reports" },
      { href: "/reports", label: { ar: "التقارير", en: "Reports" }, icon: ScrollText, resource: "reports" },
    ],
  },
  {
    key: "people",
    label: { ar: "الأشخاص", en: "People" },
    items: [
      { href: "/users", label: { ar: "المستخدمون", en: "Users" }, icon: Users, resource: "users" },
      { href: "/freelancers", label: { ar: "المستقلون", en: "Freelancers" }, icon: UserCog, resource: "freelancers" },
      { href: "/clients", label: { ar: "العملاء", en: "Clients" }, icon: Users, resource: "clients" },
      { href: "/verifications", label: { ar: "تحقق KYC", en: "KYC" }, icon: ShieldCheck, resource: "verifications" },
    ],
  },
  {
    key: "ops",
    label: { ar: "العمليات", en: "Operations" },
    items: [
      { href: "/jobs", label: { ar: "الوظائف", en: "Jobs" }, icon: Briefcase, resource: "jobs" },
      { href: "/contracts", label: { ar: "العقود", en: "Contracts" }, icon: FileText, resource: "contracts" },
      { href: "/disputes", label: { ar: "النزاعات", en: "Disputes" }, icon: AlertTriangle, resource: "disputes" },
      { href: "/complaints", label: { ar: "الشكاوى", en: "Complaints" }, icon: AlertTriangle, resource: "complaints" },
      { href: "/reviews", label: { ar: "التقييمات", en: "Reviews" }, icon: Star, resource: "reviews" },
    ],
  },
  {
    key: "finance",
    label: { ar: "المالية", en: "Finance" },
    items: [
      { href: "/payments", label: { ar: "المدفوعات", en: "Payments" }, icon: CreditCard, resource: "payments" },
      { href: "/payouts", label: { ar: "الصرفيات", en: "Payouts" }, icon: Wallet, resource: "payouts" },
    ],
  },
  {
    key: "content",
    label: { ar: "المحتوى", en: "Content" },
    items: [
      { href: "/cms-homepage", label: { ar: "الصفحة الرئيسية", en: "Homepage" }, icon: LayoutDashboard, resource: "cms" },
      { href: "/cms-navigation", label: { ar: "التنقل", en: "Navigation" }, icon: ListChecks, resource: "cms" },
      { href: "/cms-footer", label: { ar: "التذييل", en: "Footer" }, icon: Layers, resource: "cms" },
      { href: "/cms-media", label: { ar: "الوسائط", en: "Media" }, icon: FileEdit, resource: "cms" },
      { href: "/cms-seo", label: { ar: "تحسين البحث", en: "SEO" }, icon: SlidersHorizontal, resource: "seo" },
      { href: "/cms-localization", label: { ar: "الترجمات", en: "Localization" }, icon: BookOpen, resource: "localization" },
      { href: "/cms-pages", label: { ar: "صفحات CMS", en: "CMS Pages" }, icon: FileEdit, resource: "cms" },
      { href: "/cms-blocks", label: { ar: "كتل CMS", en: "CMS Blocks" }, icon: Layers, resource: "cms" },
      { href: "/blog", label: { ar: "المدونة", en: "Blog" }, icon: BookOpen, resource: "blog" },
      { href: "/faqs", label: { ar: "الأسئلة الشائعة", en: "FAQs" }, icon: HelpCircle, resource: "faqs" },
      { href: "/testimonials", label: { ar: "آراء العملاء", en: "Testimonials" }, icon: MessageSquareQuote, resource: "testimonials" },
    ],
  },
  {
    key: "security",
    label: { ar: "الأمان والدخول الموحّد", en: "Security & SSO" },
    items: [
      { href: "/sso", label: { ar: "نظرة عامة على SSO", en: "SSO Overview" }, icon: ShieldCheck, resource: "users", requireSuperAdmin: true },
      { href: "/sso/providers", label: { ar: "موفّرو SSO", en: "SSO Providers" }, icon: KeyRound, resource: "users", requireSuperAdmin: true },
      { href: "/sso/audit", label: { ar: "سجل SSO", en: "SSO Audit" }, icon: ListChecks, resource: "users", requireSuperAdmin: true },
      { href: "/sso/settings", label: { ar: "إعدادات SSO", en: "SSO Settings" }, icon: SlidersHorizontal, resource: "users", requireSuperAdmin: true },
    ],
  },
  {
    key: "system",
    label: { ar: "النظام", en: "System" },
    items: [
      { href: "/banned-words", label: { ar: "الكلمات المحظورة", en: "Banned Words" }, icon: Ban, resource: "moderation" },
      { href: "/broadcasts", label: { ar: "الإشعارات الجماعية", en: "Broadcasts" }, icon: Megaphone, resource: "notifications" },
      { href: "/audit-logs", label: { ar: "سجل التدقيق", en: "Audit Logs" }, icon: History, resource: "audit_logs" },
      { href: "/settings", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings, resource: "settings" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { lang, isRtl } = useTranslation();
  const { user } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(NAV_GROUPS.map((g) => [g.key, true])),
  );

  const toggleGroup = (key: string) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "";
    return location === href || location.startsWith(href + "/");
  };

  const ChevronCollapse = isRtl ? ChevronRight : ChevronLeft;
  const ChevronExpand = isRtl ? ChevronLeft : ChevronRight;

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border shrink-0 h-[100dvh] sticky top-0 transition-[width] duration-200",
        isRtl ? "border-l" : "border-r",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div
        className={cn(
          "h-16 flex items-center border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-2" : "justify-start px-4",
        )}
      >
        <Logo collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map((group) => {
          const isSuper = effectiveAdminRole(user) === "super_admin";
          const visibleItems = group.items.filter(
            (it) =>
              hasPermission(user, it.resource, "read") &&
              (!it.requireSuperAdmin || isSuper),
          );
          if (visibleItems.length === 0) return null;
          const open = openGroups[group.key] ?? true;
          return (
            <div key={group.key} className="space-y-1">
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover-elevate rounded"
                >
                  <span>{group.label[lang]}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open ? "" : "-rotate-90")} />
                </button>
              )}
              {(open || collapsed) && visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover-elevate",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
                        : "text-sidebar-foreground/80",
                      collapsed && "justify-center px-2",
                    )}
                    data-testid={`nav-${item.href.replace(/\//g, "-")}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label[lang]}</span>}
                  </Link>
                );
                if (!collapsed) return link;
                return (
                  <Tooltip key={item.href} delayDuration={150}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side={isRtl ? "left" : "right"}>{item.label[lang]}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm hover-elevate text-muted-foreground"
          data-testid="button-sidebar-toggle"
        >
          {collapsed ? <ChevronExpand className="w-4 h-4" /> : <ChevronCollapse className="w-4 h-4" />}
          {!collapsed && <span>{lang === "ar" ? "طيّ" : "Collapse"}</span>}
        </button>
      </div>
    </aside>
  );
}
