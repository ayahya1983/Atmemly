import { Router, type IRouter } from "express";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  db,
  paymentsTable,
  payoutsTable,
  walletsTable,
  walletTransactionsTable,
  milestonesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";

const router: IRouter = Router();

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

router.get(
  "/admin/reconciliation/daily",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const day = parseDate(typeof req.query["date"] === "string" ? req.query["date"] : undefined)
      ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const [payments] = (await db
      .select({
        captured: sql<number>`coalesce(sum(case when status in ('succeeded','released') then amount else 0 end),0)::float`,
        fees: sql<number>`coalesce(sum(platform_fee_amount),0)::float`,
        refunded: sql<number>`coalesce(sum(case when status = 'refunded' then amount else 0 end),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(paymentsTable)
      .where(and(gte(paymentsTable.createdAt, day), lt(paymentsTable.createdAt, next)))) as Array<{
        captured: number; fees: number; refunded: number; count: number;
      }>;
    const [payouts] = (await db
      .select({
        initiated: sql<number>`coalesce(sum(amount),0)::float`,
        completed: sql<number>`coalesce(sum(case when status = 'completed' then amount else 0 end),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(payoutsTable)
      .where(and(gte(payoutsTable.requestedAt, day), lt(payoutsTable.requestedAt, next)))) as Array<{
        initiated: number; completed: number; count: number;
      }>;
    const [wallets] = (await db
      .select({
        credits: sql<number>`coalesce(sum(case when amount > 0 then amount else 0 end),0)::float`,
        debits: sql<number>`coalesce(sum(case when amount < 0 then -amount else 0 end),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(walletTransactionsTable)
      .where(and(gte(walletTransactionsTable.createdAt, day), lt(walletTransactionsTable.createdAt, next)))) as Array<{
        credits: number; debits: number; count: number;
      }>;
    const discrepancy =
      Math.abs((payments?.captured ?? 0) - (payments?.refunded ?? 0) - ((wallets?.credits ?? 0) - (wallets?.debits ?? 0) + (payouts?.completed ?? 0))) > 0.5;
    respond(res, {
      date: day.toISOString().slice(0, 10),
      payments,
      payouts,
      walletMovements: wallets,
      discrepancy,
    });
  },
);

router.get(
  "/admin/reconciliation/wallets",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [walletSums] = (await db
      .select({
        available: sql<number>`coalesce(sum(available_balance),0)::float`,
        pending: sql<number>`coalesce(sum(pending_balance),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(walletsTable)) as Array<{ available: number; pending: number; count: number }>;
    const [txnSums] = (await db
      .select({
        net: sql<number>`coalesce(sum(amount),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(walletTransactionsTable)) as Array<{ net: number; count: number }>;
    const walletTotal = (walletSums?.available ?? 0) + (walletSums?.pending ?? 0);
    const txnNet = txnSums?.net ?? 0;
    const mismatchRows = await db
      .select({
        walletId: walletsTable.id,
        userId: walletsTable.userId,
        available: walletsTable.availableBalance,
        pending: walletsTable.pendingBalance,
        txnSum: sql<number>`(select coalesce(sum(amount),0)::float from wallet_transactions wt where wt.wallet_id = ${walletsTable.id})`,
      })
      .from(walletsTable)
      .limit(500);
    const discrepancies = mismatchRows.filter((r) => {
      const balance = Number(r.available) + Number(r.pending);
      return Math.abs(balance - Number(r.txnSum)) > 0.05;
    });
    respond(res, {
      walletTotal,
      transactionNet: txnNet,
      diff: Math.round((walletTotal - txnNet) * 100) / 100,
      walletCount: walletSums?.count ?? 0,
      transactionCount: txnSums?.count ?? 0,
      discrepancies: discrepancies.map((d) => ({
        walletId: d.walletId,
        userId: d.userId,
        balance: Number(d.available) + Number(d.pending),
        transactionSum: d.txnSum,
      })),
    });
  },
);

router.get(
  "/admin/reconciliation/escrow",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [paymentsHeld] = (await db
      .select({
        amount: sql<number>`coalesce(sum(amount),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "held"))) as Array<{ amount: number; count: number }>;
    const [milestonesHeld] = (await db
      .select({
        amount: sql<number>`coalesce(sum(amount),0)::float`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(milestonesTable)
      .where(eq(milestonesTable.status, "funded"))) as Array<{ amount: number; count: number }>;
    const diff = Math.round(((paymentsHeld?.amount ?? 0) - (milestonesHeld?.amount ?? 0)) * 100) / 100;
    respond(res, {
      paymentsHeld,
      milestonesFunded: milestonesHeld,
      diff,
      reconciled: Math.abs(diff) < 0.5,
    });
    return;
  },
);

const _unused = respondError;
void _unused;

export default router;
