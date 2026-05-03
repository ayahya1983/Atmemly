import { useAdminGet } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import {
  Users, Briefcase, FileText, AlertTriangle, ShieldCheck, Wallet, FileClock, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
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

const PIE_COLORS = ["#458cca", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0891b2"];

export default function AdminDashboard() {
  const { lang } = useTranslation();
  const { data, isLoading } = useAdminGet<DashboardData>(["admin-dashboard"], "/admin/dashboard");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  if (!data) return <div>{lang === "ar" ? "تعذّر تحميل البيانات" : "Failed to load dashboard"}</div>;

  const t = data.totals;

  const usersBreakdown = [
    { name: lang === "ar" ? "مستقلون" : "Freelancers", value: t.freelancers },
    { name: lang === "ar" ? "عملاء" : "Clients", value: t.clients },
    { name: lang === "ar" ? "آخرون" : "Other", value: Math.max(0, t.users - t.freelancers - t.clients) },
  ];

  const operationsBars = [
    { name: lang === "ar" ? "وظائف" : "Jobs", value: t.activeJobs },
    { name: lang === "ar" ? "عروض" : "Proposals", value: t.pendingProposals },
    { name: lang === "ar" ? "عقود" : "Contracts", value: t.activeContracts },
    { name: lang === "ar" ? "نزاعات" : "Disputes", value: t.openDisputes },
    { name: lang === "ar" ? "KYC" : "KYC", value: t.pendingVerifications },
    { name: lang === "ar" ? "صرفيات" : "Payouts", value: t.pendingPayouts },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "ar" ? "لوحة التحكم" : "Dashboard Overview"}
        description={`${lang === "ar" ? "تم التحديث" : "Updated"} ${formatDistanceToNow(new Date(data.generatedAt))} ${lang === "ar" ? "مضت" : "ago"}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={lang === "ar" ? "إجمالي المستخدمين" : "Total Users"} value={t.users.toLocaleString()} icon={Users} hint={`+${t.newUsersThisMonth} ${lang === "ar" ? "هذا الشهر" : "this month"}`} />
        <KpiCard label={lang === "ar" ? "وظائف نشطة" : "Active Jobs"} value={t.activeJobs.toLocaleString()} icon={Briefcase} tone="default" />
        <KpiCard label={lang === "ar" ? "عقود نشطة" : "Active Contracts"} value={t.activeContracts.toLocaleString()} icon={FileText} tone="success" />
        <KpiCard label={lang === "ar" ? "نزاعات مفتوحة" : "Open Disputes"} value={t.openDisputes.toLocaleString()} icon={AlertTriangle} tone="danger" />
        <KpiCard label={lang === "ar" ? "تحقق KYC معلّق" : "Pending KYC"} value={t.pendingVerifications.toLocaleString()} icon={ShieldCheck} tone="warning" />
        <KpiCard label={lang === "ar" ? "عروض معلّقة" : "Pending Proposals"} value={t.pendingProposals.toLocaleString()} icon={FileText} tone="warning" />
        <KpiCard label={lang === "ar" ? "إيرادات (مدفوع)" : "Revenue (Paid)"} value={formatCurrency(data.revenue.totalPaid, data.revenue.currency, lang)} icon={TrendingUp} tone="success" />
        <KpiCard label={lang === "ar" ? "محتجز ضماناً" : "Escrow Held"} value={formatCurrency(data.revenue.escrowHeld, data.revenue.currency, lang)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "ar" ? "نظرة على العمليات" : "Operations Snapshot"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={operationsBars} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                />
                <Bar dataKey="value" fill="#458cca" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "ar" ? "توزيع المستخدمين" : "User Mix"}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={usersBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {usersBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileClock className="w-4 h-4" />
            {lang === "ar" ? "آخر النشاطات" : "Recent Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-auto">
          {data.timeline.length === 0 ? (
            <EmptyState title={lang === "ar" ? "لا يوجد نشاط حديث" : "No recent activity"} />
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
