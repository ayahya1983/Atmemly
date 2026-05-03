import { useAdminGet, downloadCsv } from "@/lib/api-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import { Download } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/admin";
import { CHART_COLORS, getTooltipStyle, rtlAxisProps } from "@/lib/chart-utils";

interface UsersGrowth { bucket: string; items: Array<{ bucket: string; role: string; count: number }>; }
interface RevenueTs { bucket: string; items: Array<{ bucket: string; currency: string; total: number; count: number }>; }
interface TopCategories { items: Array<{ category: string; jobs: number; avg_age_days: number }>; }

export default function AdminReports() {
  const { lang } = useTranslation();
  const isAr = lang === "ar";
  const isRtl = isAr;
  const axes = rtlAxisProps(isRtl);
  const tooltipStyle = getTooltipStyle(isRtl);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? "التقارير" : "Reports"}
        description={isAr ? "تقارير قابلة للتنزيل" : "Downloadable analytics reports"}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">{isAr ? "نمو المستخدمين (شهري)" : "Users Growth (monthly)"}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/users-growth?bucket=month&format=csv", "users-growth.csv")}>
            <Download className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />CSV
          </Button>
        </CardHeader>
        <CardContent className="h-80">
          {growth.isLoading ? <Skeleton className="h-full" /> : growthData.length === 0 ? (
            <EmptyState title={isAr ? "لا توجد بيانات" : "No data"} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="freelancer" name={isAr ? "مستقل" : "Freelancer"} stackId="1" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={0.5} />
                <Area type="monotone" dataKey="client" name={isAr ? "عميل" : "Client"} stackId="1" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.5} />
                <Area type="monotone" dataKey="admin" name={isAr ? "مشرف" : "Admin"} stackId="1" stroke={CHART_COLORS.muted} fill={CHART_COLORS.muted} fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">{isAr ? "الإيرادات (شهري)" : "Revenue Time-series (monthly)"}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/revenue-timeseries?bucket=month&format=csv", "revenue-timeseries.csv")}>
            <Download className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />CSV
          </Button>
        </CardHeader>
        <CardContent className="h-80">
          {revenue.isLoading ? <Skeleton className="h-full" /> : revenueData.length === 0 ? (
            <EmptyState title={isAr ? "لا توجد بيانات" : "No data"} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="AED" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="USD" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
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
              <BarChart data={categories.data?.items ?? []} layout="vertical" margin={{ top: 10, right: 16, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} reversed={axes.xAxis.reversed} allowDecimals={false} />
                <YAxis dataKey="category" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} orientation={axes.yAxis.orientation} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="jobs" name={isAr ? "وظائف" : "Jobs"} fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
