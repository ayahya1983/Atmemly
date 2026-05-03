import { useAdminGet } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import {
  Users, UserCheck, Briefcase, FileText, AlertTriangle, ShieldCheck,
  Wallet, FileClock, TrendingUp, Banknote, Gavel, Send,
} from "lucide-react";
import { KpiCard, StatusBadge, PageHeader, EmptyState } from "@/components/admin";

interface DashboardData {
  totals: {
    users: number;
    freelancers: number;
    clients: number;
    activeJobs: number;
    pendingProposals: number;
    activeContracts: number;
    openDisputes: number;
    pendingVerifications: number;
    pendingPayouts: number;
    newUsersThisMonth: number;
  };
  revenue: { totalPaid: number; escrowHeld: number; currency: string };
  timeline: Array<{
    id: number;
    action: string;
    entityType: string | null;
    entityId: number | null;
    userName: string | null;
    createdAt: string;
  }>;
  generatedAt: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>
    </section>
  );
}

export default function AdminDashboard() {
  const { lang } = useTranslation();
  const isAr = lang === "ar";
  const { data, isLoading } = useAdminGet<DashboardData>(["admin-dashboard"], "/admin/dashboard");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array(3).fill(0).map((_, j) => <Skeleton key={j} className="h-28" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!data) return <div>{isAr ? "تعذّر تحميل البيانات" : "Failed to load dashboard"}</div>;

  const t = data.totals;

  return (
    <div className="space-y-8">
      <PageHeader
        title={isAr ? "لوحة التحكم" : "Dashboard Overview"}
        description={`${isAr ? "تم التحديث" : "Updated"} ${formatDistanceToNow(new Date(data.generatedAt))} ${isAr ? "مضت" : "ago"}`}
      />

      <Section title={isAr ? "الأشخاص" : "People"}>
        <KpiCard label={isAr ? "إجمالي المستخدمين" : "Total Users"} value={t.users.toLocaleString()} icon={Users} hint={`+${t.newUsersThisMonth} ${isAr ? "هذا الشهر" : "this month"}`} />
        <KpiCard label={isAr ? "مستقلون" : "Freelancers"} value={t.freelancers.toLocaleString()} icon={UserCheck} tone="default" />
        <KpiCard label={isAr ? "عملاء" : "Clients"} value={t.clients.toLocaleString()} icon={Briefcase} tone="default" />
      </Section>

      <Section title={isAr ? "العمليات" : "Operations"}>
        <KpiCard label={isAr ? "وظائف نشطة" : "Active Jobs"} value={t.activeJobs.toLocaleString()} icon={Briefcase} />
        <KpiCard label={isAr ? "عروض معلّقة" : "Pending Proposals"} value={t.pendingProposals.toLocaleString()} icon={Send} tone="warning" />
        <KpiCard label={isAr ? "عقود نشطة" : "Active Contracts"} value={t.activeContracts.toLocaleString()} icon={FileText} tone="success" />
      </Section>

      <Section title={isAr ? "المالية" : "Finance"}>
        <KpiCard label={isAr ? "إيرادات (مدفوع)" : "Revenue (Paid)"} value={formatCurrency(data.revenue.totalPaid, data.revenue.currency, lang)} icon={TrendingUp} tone="success" />
        <KpiCard label={isAr ? "محتجز ضماناً" : "Escrow Held"} value={formatCurrency(data.revenue.escrowHeld, data.revenue.currency, lang)} icon={Wallet} />
        <KpiCard label={isAr ? "صرفيات معلّقة" : "Pending Payouts"} value={t.pendingPayouts.toLocaleString()} icon={Banknote} tone="warning" />
      </Section>

      <Section title={isAr ? "الإشراف" : "Moderation"}>
        <KpiCard label={isAr ? "نزاعات مفتوحة" : "Open Disputes"} value={t.openDisputes.toLocaleString()} icon={Gavel} tone="danger" />
        <KpiCard label={isAr ? "تحقق KYC معلّق" : "Pending KYC"} value={t.pendingVerifications.toLocaleString()} icon={ShieldCheck} tone="warning" />
        <KpiCard label={isAr ? "تنبيهات" : "Alerts"} value={(t.openDisputes + t.pendingVerifications).toLocaleString()} icon={AlertTriangle} tone={t.openDisputes + t.pendingVerifications > 0 ? "danger" : "default"} />
      </Section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileClock className="w-4 h-4" />
            {isAr ? "آخر النشاطات" : "Recent Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-auto">
          {data.timeline.length === 0 ? (
            <EmptyState title={isAr ? "لا يوجد نشاط حديث" : "No recent activity"} />
          ) : (
            data.timeline.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between gap-4 text-sm py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={evt.action} tone="info" />
                  {evt.entityType && (
                    <span className="text-muted-foreground truncate">
                      {evt.entityType}#{evt.entityId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  {evt.userName && <span>{evt.userName}</span>}
                  <span>{formatDistanceToNow(new Date(evt.createdAt))} {isAr ? "مضت" : "ago"}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
