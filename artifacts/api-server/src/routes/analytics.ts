import { Router, type IRouter } from "express";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  paymentsTable,
  contractsTable,
  milestonesTable,
  payoutsTable,
  walletsTable,
  disputesTable,
  reviewsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.get(
  "/admin/analytics/overview",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [users] = await db.select({ c: sql<number>`count(*)::int` }).from(usersTable);
    const [clients] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "client"));
    const [freelancers] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, "freelancer"));
    const [activeJobs] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "open"));
    const [totalContracts] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contractsTable);
    const [activeContracts] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contractsTable)
      .where(eq(contractsTable.status, "active"));
    const [escrowHeld] = await db
      .select({
        s: sql<string>`coalesce(sum(${milestonesTable.amount}),0)::text`,
      })
      .from(milestonesTable)
      .where(
        sql`${milestonesTable.status} in ('funded','in_progress','submitted','revision_requested','approved')`,
      );
    const [released] = await db
      .select({
        s: sql<string>`coalesce(sum(amount),0)::text`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "succeeded"));
    const [pendingPayouts] = await db
      .select({
        c: sql<number>`count(*)::int`,
        s: sql<string>`coalesce(sum(amount),0)::text`,
      })
      .from(payoutsTable)
      .where(sql`${payoutsTable.status} in ('requested','processing')`);
    const [walletBalances] = await db
      .select({
        avail: sql<string>`coalesce(sum(available_balance),0)::text`,
        pend: sql<string>`coalesce(sum(pending_balance),0)::text`,
      })
      .from(walletsTable);
    const [openDisputes] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(disputesTable)
      .where(sql`${disputesTable.status} in ('open','under_review')`);
    const [reviewsCount] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(reviewsTable);

    res.json({
      users: users?.c ?? 0,
      clients: clients?.c ?? 0,
      freelancers: freelancers?.c ?? 0,
      activeJobs: activeJobs?.c ?? 0,
      totalContracts: totalContracts?.c ?? 0,
      activeContracts: activeContracts?.c ?? 0,
      escrowHeldAed: Number(escrowHeld?.s ?? 0),
      grossRevenueAed: Number(released?.s ?? 0),
      pendingPayoutsCount: pendingPayouts?.c ?? 0,
      pendingPayoutsAed: Number(pendingPayouts?.s ?? 0),
      walletAvailableAed: Number(walletBalances?.avail ?? 0),
      walletPendingAed: Number(walletBalances?.pend ?? 0),
      openDisputes: openDisputes?.c ?? 0,
      reviews: reviewsCount?.c ?? 0,
    });
  },
);

router.get(
  "/admin/analytics/timeseries",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const metric =
      typeof req.query["metric"] === "string" ? req.query["metric"] : "signups";
    const days = Math.min(Math.max(Number(req.query["days"] ?? 30), 1), 365);
    let table: string;
    let dateCol: string;
    let agg: string;
    switch (metric) {
      case "signups":
        table = "users";
        dateCol = "created_at";
        agg = "count(*)::int";
        break;
      case "payments":
        table = "payments";
        dateCol = "created_at";
        agg = "coalesce(sum(amount),0)::float";
        break;
      case "disputes":
        table = "disputes";
        dateCol = "created_at";
        agg = "count(*)::int";
        break;
      case "contracts":
        table = "contracts";
        dateCol = "created_at";
        agg = "count(*)::int";
        break;
      default:
        res.status(400).json({ error: "Unknown metric" });
        return;
    }
    const result = (await db.execute(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
             COALESCE((
               SELECT ${sql.raw(agg)} FROM ${sql.raw(table)}
               WHERE ${sql.raw(dateCol)}::date = d::date
                 ${metric === "payments" ? sql`AND status = 'succeeded'` : sql``}
             ), 0) AS value
      FROM generate_series(NOW() - (${days - 1} || ' days')::interval, NOW(), INTERVAL '1 day') d
      ORDER BY d
    `)) as unknown as { rows: Array<{ date: string; value: number }> };

    res.json({
      metric,
      days,
      points: result.rows.map((r) => ({ date: r.date, value: Number(r.value) })),
    });
  },
);

router.get(
  "/admin/analytics/top-categories",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const result = (await db.execute(sql`
      SELECT category_slug AS slug, count(*)::int AS jobs
      FROM jobs
      GROUP BY category_slug
      ORDER BY jobs DESC
      LIMIT 20
    `)) as unknown as { rows: Array<{ slug: string; jobs: number }> };
    res.json(result.rows);
  },
);

router.get(
  "/admin/analytics/top-freelancers",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        avgRating: sql<string>`coalesce(avg(${reviewsTable.rating})::text, '0')`,
        reviewCount: sql<number>`count(${reviewsTable.id})::int`,
        completedJobs: sql<number>`(
          select count(*)::int from contracts c
          where c.freelancer_id = ${usersTable.id} and c.status = 'completed'
        )`,
      })
      .from(usersTable)
      .leftJoin(reviewsTable, eq(reviewsTable.toUserId, usersTable.id))
      .where(eq(usersTable.role, "freelancer"))
      .groupBy(usersTable.id, usersTable.fullName)
      .orderBy(desc(sql`avg(${reviewsTable.rating})`))
      .limit(20);
    res.json(
      rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        ratingAvg: Number(r.avgRating),
        reviewCount: r.reviewCount,
        completedJobs: r.completedJobs,
      })),
    );
  },
);

void and;
export default router;
