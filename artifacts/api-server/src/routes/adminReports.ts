import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";

const router: IRouter = Router();

function csvEscape(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res: import("express").Response, name: string, headers: string[], rows: unknown[][]): void {
  const body =
    headers.join(",") +
    "\n" +
    rows.map((r) => r.map(csvEscape).join(",")).join("\n") +
    (rows.length ? "\n" : "");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
  res.send(body);
}

function wantsCsv(req: import("express").Request): boolean {
  const accept = req.header("accept") ?? "";
  if (accept.toLowerCase().includes("text/csv")) return true;
  return req.query["format"] === "csv";
}

router.get(
  "/admin/reports/users-growth",
  requireAuth,
  requirePermission("reports", "read"),
  async (req, res): Promise<void> => {
    const bucket = req.query["bucket"] === "day" ? "day" : "month";
    const truncExpr = bucket === "day" ? sql`date_trunc('day', created_at)` : sql`date_trunc('month', created_at)`;
    const fmt = bucket === "day" ? "YYYY-MM-DD" : "YYYY-MM";
    const result = (await db.execute(sql`
      SELECT to_char(${truncExpr}, ${fmt}) AS bucket,
             role,
             count(*)::int AS count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '24 months'
      GROUP BY 1, 2
      ORDER BY 1
    `)) as unknown as { rows: Array<{ bucket: string; role: string; count: number }> };
    if (wantsCsv(req)) {
      sendCsv(
        res,
        "users-growth",
        ["bucket", "role", "count"],
        result.rows.map((r) => [r.bucket, r.role, r.count]),
      );
      return;
    }
    res.json({ bucket, items: result.rows });
  },
);

// Note: /admin/reports/revenue, /top-freelancers, /top-clients are owned by
// the legacy reports.ts router (mounted earlier). We add the missing
// "users-growth" and "top-categories" reports here, plus CSV support.

router.get(
  "/admin/reports/revenue-timeseries",
  requireAuth,
  requirePermission("reports", "read"),
  async (req, res): Promise<void> => {
    const bucket = req.query["bucket"] === "day" ? "day" : "month";
    const truncExpr = bucket === "day" ? sql`date_trunc('day', created_at)` : sql`date_trunc('month', created_at)`;
    const fmt = bucket === "day" ? "YYYY-MM-DD" : "YYYY-MM";
    const result = (await db.execute(sql`
      SELECT to_char(${truncExpr}, ${fmt}) AS bucket,
             currency,
             coalesce(sum(amount), 0)::float AS total,
             count(*)::int AS count
      FROM payment_transactions
      WHERE status = 'paid'
      GROUP BY 1, 2
      ORDER BY 1
    `)) as unknown as { rows: Array<{ bucket: string; currency: string; total: number; count: number }> };
    if (wantsCsv(req)) {
      sendCsv(
        res,
        "revenue-timeseries",
        ["bucket", "currency", "total", "count"],
        result.rows.map((r) => [r.bucket, r.currency, r.total, r.count]),
      );
      return;
    }
    res.json({ bucket, items: result.rows });
  },
);

router.get(
  "/admin/reports/top-categories",
  requireAuth,
  requirePermission("reports", "read"),
  async (req, res): Promise<void> => {
    const result = (await db.execute(sql`
      SELECT category_slug AS category,
             count(*)::int AS jobs,
             coalesce(avg(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400), 0)::float AS avg_age_days
      FROM jobs
      WHERE status NOT IN ('deleted')
      GROUP BY 1
      ORDER BY jobs DESC
      LIMIT 25
    `)) as unknown as { rows: Array<{ category: string; jobs: number; avg_age_days: number }> };
    if (wantsCsv(req)) {
      sendCsv(
        res,
        "top-categories",
        ["category", "jobs", "avg_age_days"],
        result.rows.map((r) => [r.category, r.jobs, r.avg_age_days.toFixed(2)]),
      );
      return;
    }
    res.json({ items: result.rows });
  },
);

export default router;
