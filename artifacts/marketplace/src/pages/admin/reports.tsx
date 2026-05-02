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

interface UsersGrowth { bucket: string; items: Array<{ bucket: string; role: string; count: number }>; }
interface RevenueTs { bucket: string; items: Array<{ bucket: string; currency: string; total: number; count: number }>; }
interface TopCategories { items: Array<{ category: string; jobs: number; avg_age_days: number }>; }

export default function AdminReports() {
  const { lang } = useTranslation();
  const growth = useAdminGet<UsersGrowth>(["admin-reports-growth"], "/admin/reports/users-growth?bucket=month");
  const revenue = useAdminGet<RevenueTs>(["admin-reports-revenue"], "/admin/reports/revenue-timeseries?bucket=month");
  const categories = useAdminGet<TopCategories>(["admin-reports-categories"], "/admin/reports/top-categories");

  const growthData = (() => {
    if (!growth.data) return [];
    const buckets = new Map<string, Record<string, any>>();
    for (const r of growth.data.items) {
      const row = buckets.get(r.bucket) ?? { bucket: r.bucket };
      row[r.role] = r.count;
      buckets.set(r.bucket, row);
    }
    return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  })();

  const revenueData = (() => {
    if (!revenue.data) return [];
    const buckets = new Map<string, Record<string, any>>();
    for (const r of revenue.data.items) {
      const row = buckets.get(r.bucket) ?? { bucket: r.bucket };
      row[r.currency] = (row[r.currency] ?? 0) + r.total;
      buckets.set(r.bucket, row);
    }
    return Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{lang === "ar" ? "التقارير" : "Reports"}</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{lang === "ar" ? "نمو المستخدمين (شهري)" : "Users Growth (monthly)"}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/users-growth?bucket=month&format=csv", "users-growth.csv")}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
        </CardHeader>
        <CardContent className="h-80">
          {growth.isLoading ? <Skeleton className="h-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="freelancer" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                <Area type="monotone" dataKey="client" stackId="1" stroke="hsl(var(--chart-2, 220 70% 50%))" fill="hsl(var(--chart-2, 220 70% 50%))" fillOpacity={0.5} />
                <Area type="monotone" dataKey="admin" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{lang === "ar" ? "الإيرادات (شهري)" : "Revenue Time-series (monthly)"}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/revenue-timeseries?bucket=month&format=csv", "revenue-timeseries.csv")}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
        </CardHeader>
        <CardContent className="h-80">
          {revenue.isLoading ? <Skeleton className="h-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="AED" fill="hsl(var(--primary))" />
                <Bar dataKey="USD" fill="hsl(var(--chart-2, 220 70% 50%))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{lang === "ar" ? "أعلى الفئات" : "Top Categories"}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv("/admin/reports/top-categories?format=csv", "top-categories.csv")}>
            <Download className="w-3 h-3 mr-1" />CSV
          </Button>
        </CardHeader>
        <CardContent className="h-80">
          {categories.isLoading ? <Skeleton className="h-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories.data?.items ?? []} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="category" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="jobs" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
