import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, UserCog, Briefcase, FileText, CreditCard, Wallet,
  Star, AlertTriangle, ShieldCheck, FileEdit, Layers, BookOpen, HelpCircle,
  MessageSquareQuote, Ban, Megaphone, History, Settings, BarChart3, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

interface NavItem {
  href: string;
  label: { ar: string; en: string };
  icon: any;
}

interface NavGroup {
  label: { ar: string; en: string };
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: { ar: "نظرة عامة", en: "Overview" },
    items: [
      { href: "/admin", label: { ar: "لوحة التحكم", en: "Dashboard" }, icon: LayoutDashboard },
      { href: "/admin/analytics", label: { ar: "التحليلات", en: "Analytics" }, icon: BarChart3 },
      { href: "/admin/reports", label: { ar: "التقارير", en: "Reports" }, icon: ScrollText },
    ],
  },
  {
    label: { ar: "الأشخاص", en: "People" },
    items: [
      { href: "/admin/users", label: { ar: "المستخدمون", en: "Users" }, icon: Users },
      { href: "/admin/freelancers", label: { ar: "المستقلون", en: "Freelancers" }, icon: UserCog },
      { href: "/admin/clients", label: { ar: "العملاء", en: "Clients" }, icon: Users },
      { href: "/admin/verifications", label: { ar: "تحقق KYC", en: "KYC" }, icon: ShieldCheck },
    ],
  },
  {
    label: { ar: "العمليات", en: "Operations" },
    items: [
      { href: "/admin/jobs", label: { ar: "الوظائف", en: "Jobs" }, icon: Briefcase },
      { href: "/admin/contracts", label: { ar: "العقود", en: "Contracts" }, icon: FileText },
      { href: "/admin/disputes", label: { ar: "النزاعات", en: "Disputes" }, icon: AlertTriangle },
      { href: "/admin/complaints", label: { ar: "الشكاوى", en: "Complaints" }, icon: AlertTriangle },
      { href: "/admin/reviews", label: { ar: "التقييمات", en: "Reviews" }, icon: Star },
    ],
  },
  {
    label: { ar: "المالية", en: "Finance" },
    items: [
      { href: "/admin/payments", label: { ar: "المدفوعات", en: "Payments" }, icon: CreditCard },
      { href: "/admin/payouts", label: { ar: "الصرفيات", en: "Payouts" }, icon: Wallet },
    ],
  },
  {
    label: { ar: "المحتوى", en: "Content" },
    items: [
      { href: "/admin/cms-pages", label: { ar: "صفحات CMS", en: "CMS Pages" }, icon: FileEdit },
      { href: "/admin/cms-blocks", label: { ar: "كتل CMS", en: "CMS Blocks" }, icon: Layers },
      { href: "/admin/blog", label: { ar: "المدونة", en: "Blog" }, icon: BookOpen },
      { href: "/admin/faqs", label: { ar: "الأسئلة الشائعة", en: "FAQs" }, icon: HelpCircle },
      { href: "/admin/testimonials", label: { ar: "آراء العملاء", en: "Testimonials" }, icon: MessageSquareQuote },
    ],
  },
  {
    label: { ar: "النظام", en: "System" },
    items: [
      { href: "/admin/banned-words", label: { ar: "الكلمات المحظورة", en: "Banned Words" }, icon: Ban },
      { href: "/admin/broadcasts", label: { ar: "الإشعارات الجماعية", en: "Broadcasts" }, icon: Megaphone },
      { href: "/admin/audit-logs", label: { ar: "سجل التدقيق", en: "Audit Logs" }, icon: History },
      { href: "/admin/settings", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings },
    ],
  },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { lang } = useTranslation();

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location === href || location.startsWith(href + "/");
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      <aside className="w-full md:w-64 shrink-0">
        <nav className="flex md:flex-col gap-4 overflow-x-auto pb-4 md:pb-0">
          {NAV_GROUPS.map((group) => (
            <div key={group.label.en} className="space-y-1 min-w-fit">
              <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 hidden md:block">
                {group.label[lang]}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2 whitespace-nowrap"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label[lang]}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
