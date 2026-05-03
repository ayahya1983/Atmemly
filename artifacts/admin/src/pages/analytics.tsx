import { useAdminGet, downloadCsv } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, Legend,
} from "recharts";
import { Users, Briefcase, CreditCard, TrendingUp, Download } from "lucide-react";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { KpiCard, PageHeader, EmptyState } from "@/components/admin";
import { CHART_COLORS, getTooltipStyle, rtlAxisProps } from "@/lib/chart-utils";

interface DashboardData {
  totals: { users: number; activeJobs: number; pendingProposals: number };
  revenue: { totalPaid: number; currency: string };
}
interface UsersGrowth { items: Array<{ bucket: string; role: string; count: number }>; }
interface RevenueTs { items: Array<{ bucket: string; currency: string; total: number; count: number }>; }
interface TopCategories { items: Array<{ category: string; jobs: number; avg_age_days: number }>; }

export default function AdminAnalytics() {
  const { lang } = useTranslation();
  const isAr = lang === "ar";
  const isRtl = isAr;
  const axes = rtlAxisProps(isRtl);
  const tooltipStyle = getTooltipStyle(isRtl);

  const dash = useAdminGet<DashboardData>(["admin-dashboard"], "/admin/dashboard");
  const growth = useAdminGet<UsersGrowth>(["admin-reports-growth", "month"], "/admin/reports/users-growth?bucket=month");
  const revenue = useAdminGet<RevenueTs>(["admin-reports-revenue", "month"], "/admin/reports/revenue-timeseries?bucket=month");
  const categories = useAdminGet<TopCategories>(["admin-reports-categories"], "/admin/reports/top-categories");

  const growthData = (() => {
    if (!growth.data) return [];
    const buckets = new Map<string, Record<string, number | string>>();
    for (const r of growth.data.items) {
      const row = buckets.get(r.bucket) ?? { bucket: r.bucket };
      row[r.role] = r.count;
      buckets.set(r.bucket, row);
    }
    return Array.from(buckets.values()).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
  })();

  const revenueData = (() => {
    if (!revenue.data) return [];
    const buckets = new Map<string, Record<string, number | string>>();
    for (const r of revenue.data.items) {
      const row = buckets.get(r.bucket) ?? { bucket: r.bucket };
      row[r.currency] = ((row[r.currency] as number | undefined) ?? 0) + r.total;
      buckets.set(r.bucket, row);
    }
    return Array.from(buckets.values()).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
  })();

  const totals = dash.data?.totals;
  const totalRevenue = dash.data?.revenue;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? "التحليلات" : "Analytics Overview"}
        description={isAr ? "اتجاهات الاستخدام والإيرادات" : "Usage and revenue trends"}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dash.isLoading || !totals ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard label={isAr ? "إجمالي المستخدمين" : "Total Users"} value={totals.users.toLocaleString()} icon={Users} />
            <KpiCard label={isAr ? "وظائف نشطة" : "Active Jobs"} value={totals.activeJobs.toLocaleString()} icon={Briefcase} tone="default" />
            <KpiCard label={isAr ? "عروض معلّقة" : "Pending Proposals"} value={totals.pendingProposals.toLocaleString()} icon={CreditCard} tone="warning" />
            <KpiCard label={isAr ? "إجمالي الإيرادات" : "Total Revenue"} value={formatCurrency(totalRevenue?.totalPaid ?? 0, totalRevenue?.currency ?? "AED", lang)} icon={TrendingUp} tone="success" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{isAr ? "نمو المستخدمين" : "Users Growth"}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/users-growth?bucket=month&format=csv", "users-growth.csv")}>
              <Download className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />CSV
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            {growth.isLoading ? <Skeleton className="h-full" /> : growthData.length === 0 ? (
              <EmptyState title={isAr ? "لا توجد بيانات" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="freelancer" name={isAr ? "مستقل" : "Freelancer"} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="client" name={isAr ? "عميل" : "Client"} stroke={CHART_COLORS.secondary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="admin" name={isAr ? "مشرف" : "Admin"} stroke={CHART_COLORS.muted} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{isAr ? "الإيرادات بمرور الوقت" : "Revenue Timeseries"}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/revenue-timeseries?bucket=month&format=csv", "revenue-timeseries.csv")}>
              <Download className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />CSV
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            {revenue.isLoading ? <Skeleton className="h-full" /> : revenueData.length === 0 ? (
              <EmptyState title={isAr ? "لا توجد بيانات" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="AED" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.3} />
                  <Area type="monotone" dataKey="USD" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{isAr ? "أعلى الفئات" : "Top Categories"}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/top-categories?format=csv", "top-categories.csv")}>
              <Download className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />CSV
            </Button>
          </CardHeader>
          <CardContent className="h-80">
            {categories.isLoading ? <Skeleton className="h-full" /> : (categories.data?.items ?? []).length === 0 ? (
              <EmptyState title={isAr ? "لا توجد بيانات" : "No data"} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories.data?.items ?? []} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="jobs" name={isAr ? "وظائف" : "Jobs"} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
