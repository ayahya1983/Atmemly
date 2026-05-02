import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  paymentsTable,
  complaintsTable,
  auditLogsTable,
  contractsTable,
  milestonesTable,
  payoutsTable,
  walletsTable,
  walletTransactionsTable,
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
import { audit } from "../lib/audit";

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

router.get(
  "/admin/audit-logs",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 100), 1), 500);
    const action = typeof req.query["action"] === "string" ? req.query["action"] : null;
    const conditions = [];
    if (action) conditions.push(eq(auditLogsTable.action, action));
    const rows = await db
      .select({ a: auditLogsTable, u: usersTable })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(usersTable.id, auditLogsTable.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);
    res.json(
      rows.map(({ a, u }) => ({
        id: a.id,
        userId: a.userId,
        userName: u?.fullName ?? null,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: (a.metadata as Record<string, unknown>) ?? {},
        ip: a.ip,
        userAgent: a.userAgent,
        createdAt: a.createdAt,
      })),
    );
  },
);

router.get(
  "/admin/contracts",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({ c: contractsTable, j: jobsTable })
      .from(contractsTable)
      .leftJoin(jobsTable, eq(jobsTable.id, contractsTable.jobId))
      .orderBy(desc(contractsTable.createdAt))
      .limit(500);
    const out = await Promise.all(
      rows.map(async ({ c, j }) => {
        const [client] = await db.select().from(usersTable).where(eq(usersTable.id, c.clientId));
        const [freelancer] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, c.freelancerId));
        const [agg] = await db
          .select({
            n: sql<number>`count(*)::int`,
            funded: sql<string>`coalesce(sum(case when ${milestonesTable.status} in ('funded','in_progress','submitted','revision_requested','approved') then ${milestonesTable.amount} else 0 end),0)::text`,
            released: sql<string>`coalesce(sum(case when ${milestonesTable.status} = 'released' then ${milestonesTable.amount} else 0 end),0)::text`,
          })
          .from(milestonesTable)
          .where(eq(milestonesTable.contractId, c.id));
        return {
          id: c.id,
          jobId: c.jobId,
          jobTitle: j?.title ?? "",
          proposalId: c.proposalId,
          clientId: c.clientId,
          clientName: client?.fullName ?? "",
          freelancerId: c.freelancerId,
          freelancerName: freelancer?.fullName ?? "",
          title: c.title,
          contractType: c.contractType,
          status: c.status,
          totalAmount: Number(c.totalAmount),
          currency: c.currency,
          platformFeePct: Number(c.platformFeePct),
          startDate: c.startDate,
          endDate: c.endDate,
          createdAt: c.createdAt,
          milestoneCount: agg?.n ?? 0,
          fundedAmount: Number(agg?.funded ?? 0),
          releasedAmount: Number(agg?.released ?? 0),
        };
      }),
    );
    res.json(out);
  },
);

router.get(
  "/admin/payouts",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({ p: payoutsTable, u: usersTable })
      .from(payoutsTable)
      .leftJoin(usersTable, eq(usersTable.id, payoutsTable.freelancerId))
      .orderBy(desc(payoutsTable.requestedAt))
      .limit(500);
    res.json(
      rows.map(({ p, u }) => ({
        id: p.id,
        freelancerId: p.freelancerId,
        freelancerName: u?.fullName ?? "",
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        method: p.method,
        note: p.note,
        reference: p.reference,
        requestedAt: p.requestedAt,
        processedAt: p.processedAt,
        processedBy: p.processedBy,
      })),
    );
  },
);

router.post(
  "/admin/payouts/:id/process",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const reference =
      typeof req.body?.reference === "string" ? req.body.reference : null;
    const note = typeof req.body?.note === "string" ? req.body.note : null;
    const [payout] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id));
    if (!payout) {
      res.status(404).json({ error: "Payout not found" });
      return;
    }
    if (payout.status !== "requested" && payout.status !== "processing") {
      res.status(400).json({ error: "Payout cannot be processed in current state" });
      return;
    }
    const amount = Number(payout.amount);
    // Conditional UPDATE: only the first admin to process a given payout wins.
    const [updated] = await db
      .update(payoutsTable)
      .set({
        status: "paid",
        processedAt: new Date(),
        processedBy: req.user!.id,
        reference,
        note: note ?? payout.note,
      })
      .where(
        and(
          eq(payoutsTable.id, id),
          sql`${payoutsTable.status} in ('requested','processing')`,
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "Payout was processed concurrently" });
      return;
    }
    // Record a settlement transaction so wallet ledger reflects the actual payout
    const [wallet] = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, payout.freelancerId));
    if (wallet) {
      await db.insert(walletTransactionsTable).values({
        walletId: wallet.id,
        type: "adjustment",
        amount: "0",
        currency: wallet.currency,
        refType: "payout",
        refId: payout.id,
        note: `Payout processed${reference ? ` (ref: ${reference})` : ""}`,
      });
    }
    await audit(req, "payout.process", "payout", id, {
      amount,
      reference,
    });
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payout.freelancerId));
    res.json({
      id: updated!.id,
      freelancerId: updated!.freelancerId,
      freelancerName: u?.fullName ?? "",
      amount: Number(updated!.amount),
      currency: updated!.currency,
      status: updated!.status,
      method: updated!.method,
      note: updated!.note,
      reference: updated!.reference,
      requestedAt: updated!.requestedAt,
      processedAt: updated!.processedAt,
      processedBy: updated!.processedBy,
    });
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
