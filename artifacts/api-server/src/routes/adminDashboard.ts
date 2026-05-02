import { Router, type IRouter } from "express";
import { sql, eq, and, gte, isNull, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  contractsTable,
  disputesTable,
  verificationsTable,
  payoutsTable,
  paymentTransactionsTable,
  escrowEventsTable,
  auditLogsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";

const router: IRouter = Router();

interface DashboardSnapshot {
  data: unknown;
  expiresAt: number;
}
let cache: DashboardSnapshot | null = null;
const CACHE_TTL_MS = 30_000;

router.get(
  "/admin/dashboard",
  requireAuth,
  requirePermission("dashboard", "read"),
  async (_req, res): Promise<void> => {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      res.json(cache.data);
      return;
    }
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalFreelancers,
      totalClients,
      activeJobs,
      pendingProposals,
      activeContracts,
      openDisputes,
      pendingVerifications,
      pendingPayouts,
      newUsersMonth,
      revenueRow,
      escrowHeldRow,
      timelineRows,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(usersTable),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, "freelancer")),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, "client")),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(jobsTable)
        .where(eq(jobsTable.status, "open")),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(proposalsTable)
        .where(eq(proposalsTable.status, "pending")),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(contractsTable)
        .where(sql`${contractsTable.status} in ('active','funded','in_progress')`),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(disputesTable)
        .where(sql`${disputesTable.status} in ('open','investigating')`),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(verificationsTable)
        .where(eq(verificationsTable.status, "pending")),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(payoutsTable)
        .where(sql`${payoutsTable.status} in ('requested','processing')`),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(gte(usersTable.createdAt, monthStart)),
      db
        .select({ s: sql<string>`coalesce(sum(amount), 0)::text` })
        .from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.status, "paid")),
      db
        .select({ s: sql<string>`coalesce(sum(amount), 0)::text` })
        .from(escrowEventsTable)
        .where(eq(escrowEventsTable.toState, "held")),
      db
        .select({ a: auditLogsTable, u: usersTable })
        .from(auditLogsTable)
        .leftJoin(usersTable, eq(usersTable.id, auditLogsTable.userId))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(30),
    ]);

    const [escrowReleasedRow] = await db
      .select({ s: sql<string>`coalesce(sum(amount), 0)::text` })
      .from(escrowEventsTable)
      .where(eq(escrowEventsTable.toState, "released"));
    const escrowHeld = Number(escrowHeldRow[0]?.s ?? 0);
    const escrowReleased = Number(escrowReleasedRow?.s ?? 0);

    const data = {
      totals: {
        users: totalUsers[0]?.c ?? 0,
        freelancers: totalFreelancers[0]?.c ?? 0,
        clients: totalClients[0]?.c ?? 0,
        activeJobs: activeJobs[0]?.c ?? 0,
        pendingProposals: pendingProposals[0]?.c ?? 0,
        activeContracts: activeContracts[0]?.c ?? 0,
        openDisputes: openDisputes[0]?.c ?? 0,
        pendingVerifications: pendingVerifications[0]?.c ?? 0,
        pendingPayouts: pendingPayouts[0]?.c ?? 0,
        newUsersThisMonth: newUsersMonth[0]?.c ?? 0,
      },
      revenue: {
        totalPaid: Number(revenueRow[0]?.s ?? 0),
        escrowHeld: Math.max(0, escrowHeld - escrowReleased),
        currency: "AED",
      },
      timeline: timelineRows.map(({ a, u }) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        userId: a.userId,
        userName: u?.fullName ?? null,
        createdAt: a.createdAt,
      })),
      generatedAt: new Date().toISOString(),
    };
    cache = { data, expiresAt: now + CACHE_TTL_MS };
    res.json(data);
    void isNull;
    void and;
  },
);

export default router;
