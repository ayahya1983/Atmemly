import { useAdminGet } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import {
  Users, Briefcase, FileText, AlertTriangle, ShieldCheck, Wallet, FileClock,
} from "lucide-react";

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

const Kpi = ({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: string }) => (
  <Card>
    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      <Icon className={`w-4 h-4 ${accent ?? "text-primary"}`} />
    </CardHeader>
    <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
  </Card>
);

export default function AdminDashboard() {
  const { lang } = useTranslation();
  const { data, isLoading } = useAdminGet<DashboardData>(["admin-dashboard"], "/admin/dashboard");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }
  if (!data) return <div>{lang === "ar" ? "تعذّر تحميل البيانات" : "Failed to load dashboard"}</div>;

  const t = data.totals;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{lang === "ar" ? "لوحة التحكم" : "Dashboard Overview"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === "ar" ? "تم التحديث" : "Updated"} {formatDistanceToNow(new Date(data.generatedAt))} {lang === "ar" ? "مضت" : "ago"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label={lang === "ar" ? "إجمالي المستخدمين" : "Total Users"} value={t.users} icon={Users} />
        <Kpi label={lang === "ar" ? "المستقلون" : "Freelancers"} value={t.freelancers} icon={Users} />
        <Kpi label={lang === "ar" ? "العملاء" : "Clients"} value={t.clients} icon={Users} />
        <Kpi label={lang === "ar" ? "جدد هذا الشهر" : "New This Month"} value={t.newUsersThisMonth} icon={Users} accent="text-emerald-600" />
        <Kpi label={lang === "ar" ? "وظائف نشطة" : "Active Jobs"} value={t.activeJobs} icon={Briefcase} />
        <Kpi label={lang === "ar" ? "عروض معلّقة" : "Pending Proposals"} value={t.pendingProposals} icon={FileText} />
        <Kpi label={lang === "ar" ? "عقود نشطة" : "Active Contracts"} value={t.activeContracts} icon={FileText} />
        <Kpi label={lang === "ar" ? "نزاعات مفتوحة" : "Open Disputes"} value={t.openDisputes} icon={AlertTriangle} accent="text-destructive" />
        <Kpi label={lang === "ar" ? "تحقق KYC معلّق" : "Pending KYC"} value={t.pendingVerifications} icon={ShieldCheck} accent="text-amber-600" />
        <Kpi label={lang === "ar" ? "صرفيات معلّقة" : "Pending Payouts"} value={t.pendingPayouts} icon={Wallet} accent="text-amber-600" />
        <Kpi label={lang === "ar" ? "إيرادات (مدفوع)" : "Revenue (Paid)"} value={formatCurrency(data.revenue.totalPaid, data.revenue.currency, lang)} icon={Wallet} accent="text-emerald-600" />
        <Kpi label={lang === "ar" ? "محتجز ضماناً" : "Escrow Held"} value={formatCurrency(data.revenue.escrowHeld, data.revenue.currency, lang)} icon={Wallet} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileClock className="w-4 h-4" />
            {lang === "ar" ? "آخر النشاطات" : "Recent Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-auto">
          {data.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا يوجد نشاط حديث" : "No recent activity"}</p>
          ) : (
            data.timeline.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between gap-4 text-sm py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="font-mono text-xs">{evt.action}</Badge>
                  {evt.entityType && (
                    <span className="text-muted-foreground truncate">
                      {evt.entityType}#{evt.entityId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  {evt.userName && <span>{evt.userName}</span>}
                  <span>{formatDistanceToNow(new Date(evt.createdAt))} {lang === "ar" ? "مضت" : "ago"}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
