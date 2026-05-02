import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  paymentsTable,
  complaintsTable,
} from "@workspace/db";
import {
  AdminListUsersResponse,
  AdminUpdateUserStatusParams,
  AdminUpdateUserStatusBody,
  AdminUpdateUserStatusResponse,
  AdminListJobsResponse,
  AdminListPaymentsResponse,
  AdminAnalyticsResponse,
  AdminListComplaintsResponse,
  CreateComplaintBody,
  CreateComplaintResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/admin/users", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const out = await Promise.all(
    users.map(async (u) => {
      const [jc] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(jobsTable)
        .where(eq(jobsTable.clientId, u.id));
      const [pc] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(proposalsTable)
        .where(eq(proposalsTable.freelancerId, u.id));
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        jobsCount: jc?.c ?? 0,
        proposalsCount: pc?.c ?? 0,
      };
    }),
  );
  res.json(AdminListUsersResponse.parse(out));
});

router.patch(
  "/admin/users/:id/status",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = AdminUpdateUserStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AdminUpdateUserStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({ status: parsed.data.status })
      .where(eq(usersTable.id, params.data.id))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [jc] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.clientId, user.id));
    const [pc] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(proposalsTable)
      .where(eq(proposalsTable.freelancerId, user.id));
    res.json(
      AdminUpdateUserStatusResponse.parse({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        jobsCount: jc?.c ?? 0,
        proposalsCount: pc?.c ?? 0,
      }),
    );
  },
);

router.get("/admin/jobs", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({ j: jobsTable, u: usersTable })
    .from(jobsTable)
    .innerJoin(usersTable, eq(usersTable.id, jobsTable.clientId))
    .orderBy(desc(jobsTable.createdAt));
  const out = await Promise.all(
    rows.map(async ({ j, u }) => {
      const [count] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(proposalsTable)
        .where(eq(proposalsTable.jobId, j.id));
      return {
        id: j.id,
        title: j.title,
        descriptionShort: j.description.slice(0, 220),
        categorySlug: j.categorySlug,
        categoryNameEn: j.categorySlug,
        categoryNameAr: j.categorySlug,
        budgetType: j.budgetType,
        budgetMin: Number(j.budgetMin),
        budgetMax: Number(j.budgetMax),
        currency: j.currency,
        skills: j.skills,
        status: j.status,
        deadline: j.deadline,
        createdAt: j.createdAt,
        proposalCount: count?.c ?? 0,
        clientId: u.id,
        clientName: u.fullName,
      };
    }),
  );
  res.json(AdminListJobsResponse.parse(out));
});

router.get(
  "/admin/payments",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(paymentsTable).orderBy(desc(paymentsTable.createdAt));
    const out = await Promise.all(
      rows.map(async (p) => {
        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, p.jobId));
        const [payer] = await db.select().from(usersTable).where(eq(usersTable.id, p.payerId));
        const [payee] = await db.select().from(usersTable).where(eq(usersTable.id, p.payeeId));
        return {
          id: p.id,
          jobId: p.jobId,
          jobTitle: job?.title ?? "",
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          payerName: payer?.fullName ?? "",
          payeeName: payee?.fullName ?? "",
          invoiceNumber: p.invoiceNumber,
          createdAt: p.createdAt,
        };
      }),
    );
    res.json(AdminListPaymentsResponse.parse(out));
  },
);

router.get(
  "/admin/analytics",
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
    const [jobs] = await db.select({ c: sql<number>`count(*)::int` }).from(jobsTable);
    const [activeJobs] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "open"));
    const [proposals] = await db.select({ c: sql<number>`count(*)::int` }).from(proposalsTable);
    const [payments] = await db.select({ c: sql<number>`count(*)::int` }).from(paymentsTable);
    const [revenue] = await db
      .select({ s: sql<string>`coalesce(sum(amount), 0)::text` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.status, "succeeded"), eq(paymentsTable.currency, "AED")));

    const recentSignups = (await db.execute(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(CASE WHEN u.created_at::date = d::date THEN 1 ELSE 0 END), 0)::int AS count
      FROM generate_series(NOW() - INTERVAL '13 days', NOW(), INTERVAL '1 day') d
      LEFT JOIN users u ON u.created_at::date = d::date
      GROUP BY d
      ORDER BY d
    `)) as unknown as { rows: Array<{ date: string; count: number }> };

    const jobsByCategory = (await db.execute(sql`
      SELECT category_slug AS category, count(*)::int AS count
      FROM jobs
      GROUP BY category_slug
      ORDER BY count DESC
      LIMIT 10
    `)) as unknown as { rows: Array<{ category: string; count: number }> };

    const paymentsByMonth = (await db.execute(sql`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
             coalesce(sum(amount), 0)::float AS total
      FROM payments
      WHERE status = 'succeeded'
      GROUP BY 1
      ORDER BY 1
      LIMIT 12
    `)) as unknown as { rows: Array<{ month: string; total: number }> };

    res.json(
      AdminAnalyticsResponse.parse({
        users: users?.c ?? 0,
        clients: clients?.c ?? 0,
        freelancers: freelancers?.c ?? 0,
        jobs: jobs?.c ?? 0,
        activeJobs: activeJobs?.c ?? 0,
        proposals: proposals?.c ?? 0,
        payments: payments?.c ?? 0,
        revenueAed: Number(revenue?.s ?? 0),
        recentSignups: recentSignups.rows ?? [],
        jobsByCategory: jobsByCategory.rows ?? [],
        paymentsByMonth: paymentsByMonth.rows ?? [],
      }),
    );
  },
);

router.get(
  "/admin/complaints",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({ c: complaintsTable, u: usersTable })
      .from(complaintsTable)
      .innerJoin(usersTable, eq(usersTable.id, complaintsTable.fromUserId))
      .orderBy(desc(complaintsTable.createdAt));
    res.json(
      AdminListComplaintsResponse.parse(
        rows.map(({ c, u }) => ({
          id: c.id,
          fromUserId: c.fromUserId,
          fromUserName: u.fullName,
          subject: c.subject,
          body: c.body,
          status: c.status,
          createdAt: c.createdAt,
        })),
      ),
    );
  },
);

router.post("/complaints", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateComplaintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [c] = await db
    .insert(complaintsTable)
    .values({
      fromUserId: req.user!.id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "open",
    })
    .returning();
  res.json(
    CreateComplaintResponse.parse({
      id: c!.id,
      fromUserId: c!.fromUserId,
      fromUserName: req.user!.fullName,
      subject: c!.subject,
      body: c!.body,
      status: c!.status,
      createdAt: c!.createdAt,
    }),
  );
});

export default router;
