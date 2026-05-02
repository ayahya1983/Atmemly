import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, desc, gte, lte, sql } from "drizzle-orm";
import {
  db,
  paymentTransactionsTable,
  paymentWebhooksTable,
  paymentGatewaysTable,
  paymentsTable,
  payoutsTable,
  walletsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError, parsePagination, paginate } from "../lib/apiResponse";
import { ALL_GATEWAY_NAMES } from "../lib/payments";
import { markTransactionPaidAndFundEscrow } from "../lib/payments/processing";
import { audit } from "../lib/audit";
import { notify } from "../lib/notify";

const router: IRouter = Router();

// ----------------------------------------------------------------------------
// GET /admin/payments/transactions — admin list with filters.
// ----------------------------------------------------------------------------
router.get(
  "/admin/payments/transactions",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { page, perPage, offset } = parsePagination(req.query as Record<string, unknown>);
    const conditions = [];
    const q = req.query as Record<string, string | undefined>;
    if (q["gateway"]) conditions.push(eq(paymentTransactionsTable.gateway, q["gateway"]!));
    if (q["status"]) conditions.push(eq(paymentTransactionsTable.status, q["status"]!));
    if (q["userId"]) conditions.push(eq(paymentTransactionsTable.userId, Number(q["userId"])));
    if (q["contractId"])
      conditions.push(eq(paymentTransactionsTable.contractId, Number(q["contractId"])));
    if (q["dateFrom"])
      conditions.push(gte(paymentTransactionsTable.createdAt, new Date(q["dateFrom"]!)));
    if (q["dateTo"])
      conditions.push(lte(paymentTransactionsTable.createdAt, new Date(q["dateTo"]!)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQ = db.select({ count: sql<number>`count(*)::int` }).from(paymentTransactionsTable);
    const [{ count }] = await (where ? baseQ.where(where) : baseQ);
    const rowsQ = db
      .select()
      .from(paymentTransactionsTable)
      .orderBy(desc(paymentTransactionsTable.createdAt))
      .limit(perPage)
      .offset(offset);
    const rows = await (where ? rowsQ.where(where) : rowsQ);
    respond(res, rows, { pagination: paginate(page, perPage, Number(count)) });
  },
);

// ----------------------------------------------------------------------------
// GET /admin/payments/webhooks — recent raw webhook events for debugging.
// ----------------------------------------------------------------------------
router.get(
  "/admin/payments/webhooks",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { page, perPage, offset } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string | undefined>;
    const conditions = [];
    if (q["gateway"]) conditions.push(eq(paymentWebhooksTable.gateway, q["gateway"]!));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQ = db.select({ count: sql<number>`count(*)::int` }).from(paymentWebhooksTable);
    const [{ count }] = await (where ? baseQ.where(where) : baseQ);
    const rowsQ = db
      .select()
      .from(paymentWebhooksTable)
      .orderBy(desc(paymentWebhooksTable.receivedAt))
      .limit(perPage)
      .offset(offset);
    const rows = await (where ? rowsQ.where(where) : rowsQ);
    respond(res, rows, { pagination: paginate(page, perPage, Number(count)) });
  },
);

// ----------------------------------------------------------------------------
// POST /admin/payments/manual/approve — approve a pending manual transfer.
// ----------------------------------------------------------------------------
const ApproveBody = z.object({
  transactionId: z.number().int().positive(),
  bankReference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
});

router.post(
  "/admin/payments/manual/approve",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = ApproveBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.id, parsed.data.transactionId));
    if (!tx) {
      respondError(res, 404, "transaction_not_found", "Transaction not found");
      return;
    }
    if (tx.gateway !== "manual") {
      respondError(res, 400, "wrong_gateway", "Only manual transactions can be approved here");
      return;
    }
    if (tx.status !== "PENDING") {
      respondError(res, 409, "invalid_state", `Cannot approve a ${tx.status} transaction`);
      return;
    }
    // Preserve the gateway-assigned manual_<uuid> reference (used by webhook
    // lookups + the UNIQUE (gateway, gateway_reference) index). The human-
    // entered bank reference is metadata, not the gateway id.
    if (parsed.data.bankReference) {
      const merged = { ...(tx.metadata ?? {}), bankReference: parsed.data.bankReference };
      await db
        .update(paymentTransactionsTable)
        .set({ metadata: merged, updatedAt: new Date() })
        .where(eq(paymentTransactionsTable.id, tx.id));
    }
    const ok = await markTransactionPaidAndFundEscrow({
      transaction: tx,
      gatewayReference: tx.gatewayReference,
      reason: `manual approve by admin ${req.user!.id}: ${parsed.data.note ?? "approved"}`,
    });
    await audit(req, "payments.manual.approved", "payment_transaction", tx.id, {
      bankReference: parsed.data.bankReference,
      note: parsed.data.note,
      acted: ok,
    });
    await notify({
      userId: tx.userId,
      kind: "payment",
      title: "Bank transfer approved",
      body: `Your transfer for transaction #${tx.id} has been approved.`,
      link: `/dashboard/client/payments/${tx.id}`,
    });
    const [refreshed] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.id, tx.id));
    respond(res, { transaction: refreshed, escrowFunded: ok });
  },
);

// ----------------------------------------------------------------------------
// POST /admin/payments/manual/reject — reject a pending manual transfer.
// ----------------------------------------------------------------------------
const RejectBody = z.object({
  transactionId: z.number().int().positive(),
  reason: z.string().min(3).max(500),
});

router.post(
  "/admin/payments/manual/reject",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = RejectBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.id, parsed.data.transactionId));
    if (!tx) {
      respondError(res, 404, "transaction_not_found", "Transaction not found");
      return;
    }
    if (tx.gateway !== "manual") {
      respondError(res, 400, "wrong_gateway", "Only manual transactions can be rejected here");
      return;
    }
    if (tx.status !== "PENDING") {
      respondError(res, 409, "invalid_state", `Cannot reject a ${tx.status} transaction`);
      return;
    }
    await db
      .update(paymentTransactionsTable)
      .set({
        status: "FAILED",
        failureReason: parsed.data.reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactionsTable.id, tx.id));
    await audit(req, "payments.manual.rejected", "payment_transaction", tx.id, {
      reason: parsed.data.reason,
    });
    await notify({
      userId: tx.userId,
      kind: "payment",
      title: "Bank transfer rejected",
      body: `Your transfer for transaction #${tx.id} was rejected: ${parsed.data.reason}`,
      link: `/dashboard/client/payments/${tx.id}`,
    });
    respond(res, { transactionId: tx.id, status: "FAILED" });
  },
);

// ----------------------------------------------------------------------------
// GET /admin/payments/summary — financial dashboard for admins.
// ----------------------------------------------------------------------------
router.get(
  "/admin/payments/summary",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [pt] = await db
      .select({
        gross: sql<string>`coalesce(sum(case when ${paymentsTable.status} in ('held','released') then ${paymentsTable.amount} else 0 end), 0)`,
        platformFees: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'released' then ${paymentsTable.platformFeeAmount} else 0 end), 0)`,
        held: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'held' then ${paymentsTable.amount} else 0 end), 0)`,
        released: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'released' then ${paymentsTable.freelancerNetAmount} else 0 end), 0)`,
        refunded: sql<string>`coalesce(sum(case when ${paymentsTable.status} = 'refunded' then ${paymentsTable.amount} else 0 end), 0)`,
      })
      .from(paymentsTable);
    const [pendingPayouts] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${payoutsTable.amount}), 0)`,
      })
      .from(payoutsTable)
      .where(eq(payoutsTable.status, "requested"));
    const [walletAgg] = await db
      .select({
        availableTotal: sql<string>`coalesce(sum(${walletsTable.availableBalance}), 0)`,
        pendingTotal: sql<string>`coalesce(sum(${walletsTable.pendingBalance}), 0)`,
      })
      .from(walletsTable);
    const [txCounts] = await db
      .select({
        initiated: sql<number>`coalesce(sum(case when ${paymentTransactionsTable.status} = 'INITIATED' then 1 else 0 end), 0)::int`,
        pending: sql<number>`coalesce(sum(case when ${paymentTransactionsTable.status} = 'PENDING' then 1 else 0 end), 0)::int`,
        paid: sql<number>`coalesce(sum(case when ${paymentTransactionsTable.status} in ('PAID','ESCROW_HELD','RELEASED') then 1 else 0 end), 0)::int`,
        failed: sql<number>`coalesce(sum(case when ${paymentTransactionsTable.status} = 'FAILED' then 1 else 0 end), 0)::int`,
        refunded: sql<number>`coalesce(sum(case when ${paymentTransactionsTable.status} in ('REFUNDED','PARTIALLY_REFUNDED') then 1 else 0 end), 0)::int`,
      })
      .from(paymentTransactionsTable);
    respond(res, {
      currency: "AED",
      grossMarketplaceVolume: Number(pt!.gross),
      platformFees: Number(pt!.platformFees),
      heldEscrow: Number(pt!.held),
      releasedEarnings: Number(pt!.released),
      refunded: Number(pt!.refunded),
      pendingPayouts: { count: Number(pendingPayouts!.count), total: Number(pendingPayouts!.total) },
      wallets: {
        available: Number(walletAgg!.availableTotal),
        pending: Number(walletAgg!.pendingTotal),
      },
      transactions: txCounts,
    });
  },
);

// ----------------------------------------------------------------------------
// Admin gateway registry CRUD.
// ----------------------------------------------------------------------------
router.get(
  "/admin/payments/gateways",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(paymentGatewaysTable)
      .orderBy(paymentGatewaysTable.sortOrder, paymentGatewaysTable.id);
    respond(res, rows);
  },
);

const UpsertGatewayBody = z.object({
  name: z.string().min(1).max(80),
  providerCode: z.enum(ALL_GATEWAY_NAMES as [string, ...string[]]),
  isActive: z.boolean().optional(),
  mode: z.enum(["TEST", "LIVE"]).optional(),
  supportedCurrencies: z.array(z.string().length(3)).optional(),
  configJson: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

router.post(
  "/admin/payments/gateways",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = UpsertGatewayBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const v = parsed.data;
    const [row] = await db
      .insert(paymentGatewaysTable)
      .values({
        name: v.name,
        providerCode: v.providerCode,
        isActive: v.isActive ?? false,
        mode: v.mode ?? "TEST",
        supportedCurrencies: v.supportedCurrencies ?? [],
        configJson: v.configJson ?? {},
        sortOrder: v.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: paymentGatewaysTable.providerCode,
        set: {
          name: v.name,
          ...(v.isActive != null ? { isActive: v.isActive } : {}),
          ...(v.mode ? { mode: v.mode } : {}),
          ...(v.supportedCurrencies ? { supportedCurrencies: v.supportedCurrencies } : {}),
          ...(v.configJson ? { configJson: v.configJson } : {}),
          ...(v.sortOrder != null ? { sortOrder: v.sortOrder } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    await audit(req, "payments.gateway.upsert", "payment_gateway", row!.id, {
      providerCode: v.providerCode,
    });
    respond(res, row);
  },
);

const PatchGatewayBody = z.object({
  isActive: z.boolean().optional(),
  mode: z.enum(["TEST", "LIVE"]).optional(),
  name: z.string().min(1).max(80).optional(),
  supportedCurrencies: z.array(z.string().length(3)).optional(),
  configJson: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

router.patch(
  "/admin/payments/gateways/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      respondError(res, 400, "invalid_id", "Invalid gateway id");
      return;
    }
    const parsed = PatchGatewayBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) updates[k] = v;
    }
    const [row] = await db
      .update(paymentGatewaysTable)
      .set(updates)
      .where(eq(paymentGatewaysTable.id, id))
      .returning();
    if (!row) {
      respondError(res, 404, "gateway_not_found", "Gateway not found");
      return;
    }
    await audit(req, "payments.gateway.patch", "payment_gateway", row.id, parsed.data);
    respond(res, row);
  },
);

export default router;
