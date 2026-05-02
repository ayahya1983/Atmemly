import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, sql, gte } from "drizzle-orm";
import {
  db,
  payoutsTable,
  payoutBatchesTable,
  payoutBatchItemsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError, parsePagination, paginate } from "../lib/apiResponse";
import { audit } from "../lib/audit";

const router: IRouter = Router();

const CreateBatchBody = z.object({
  minAmount: z.number().nonnegative().optional(),
  freelancerIds: z.array(z.number().int().positive()).optional(),
  currency: z.string().length(3).optional(),
  note: z.string().max(500).optional(),
});

router.post(
  "/admin/payout-batches",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBatchBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    // A batch must be single-currency. Caller may pin via body.currency;
    // otherwise we infer from the oldest requested payout and only batch
    // matching ones, leaving other currencies for separate batches.
    const conditions = [eq(payoutsTable.status, "requested")];
    if (parsed.data.minAmount != null) {
      conditions.push(gte(payoutsTable.amount, String(parsed.data.minAmount)));
    }
    if (parsed.data.freelancerIds && parsed.data.freelancerIds.length > 0) {
      conditions.push(inArray(payoutsTable.freelancerId, parsed.data.freelancerIds));
    }
    if (parsed.data.currency) {
      conditions.push(eq(payoutsTable.currency, parsed.data.currency.toUpperCase()));
    }
    const allCandidates = await db
      .select()
      .from(payoutsTable)
      .where(and(...conditions))
      .orderBy(payoutsTable.requestedAt);
    if (allCandidates.length === 0) {
      respondError(res, 400, "no_candidates", "No requested payouts match the criteria");
      return;
    }
    const currency = parsed.data.currency
      ? parsed.data.currency.toUpperCase()
      : allCandidates[0]!.currency;
    const candidates = allCandidates.filter((p) => p.currency === currency);
    if (candidates.length === 0) {
      respondError(res, 400, "no_candidates", `No requested payouts in currency ${currency}`);
      return;
    }
    const total = candidates.reduce((s, p) => s + Number(p.amount), 0);
    const result = await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(payoutBatchesTable)
        .values({
          status: "draft",
          currency,
          totalAmount: String(total),
          itemCount: candidates.length,
          note: parsed.data.note ?? null,
          createdById: req.user!.id,
        })
        .returning();
      const items = candidates.map((p) => ({
        batchId: batch!.id,
        payoutId: p.id,
        amount: p.amount,
      }));
      await tx.insert(payoutBatchItemsTable).values(items);
      await tx
        .update(payoutsTable)
        .set({ status: "batched" })
        .where(inArray(payoutsTable.id, candidates.map((c) => c.id)));
      return batch!;
    });
    await audit(req, "payout_batch.create", "payout_batch", result.id, {
      itemCount: candidates.length,
      total,
      currency,
    });
    respond(res, result);
  },
);

router.post(
  "/admin/payout-batches/:id/process",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      respondError(res, 400, "invalid_id", "Invalid batch id");
      return;
    }
    const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
    if (!batch) {
      respondError(res, 404, "batch_not_found", "Batch not found");
      return;
    }
    if (batch.status !== "draft") {
      respondError(res, 409, "invalid_state", `Batch is ${batch.status}`);
      return;
    }
    await db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(payoutBatchItemsTable)
        .where(eq(payoutBatchItemsTable.batchId, batch.id));
      const payoutIds = items.map((i) => i.payoutId);
      if (payoutIds.length > 0) {
        await tx
          .update(payoutsTable)
          .set({ status: "completed", processedAt: new Date(), processedBy: req.user!.id })
          .where(inArray(payoutsTable.id, payoutIds));
      }
      await tx
        .update(payoutBatchesTable)
        .set({ status: "completed", processedAt: new Date(), processedById: req.user!.id })
        .where(eq(payoutBatchesTable.id, batch.id));
    });
    await audit(req, "payout_batch.process", "payout_batch", batch.id, {
      itemCount: batch.itemCount,
    });
    respond(res, { id: batch.id, status: "completed" });
  },
);

router.get(
  "/admin/payout-batches",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { page, perPage, offset } = parsePagination(req.query as Record<string, unknown>);
    const [{ total }] = (await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(payoutBatchesTable)) as Array<{ total: number }>;
    const rows = await db
      .select()
      .from(payoutBatchesTable)
      .orderBy(desc(payoutBatchesTable.createdAt))
      .limit(perPage)
      .offset(offset);
    respond(res, rows, { pagination: paginate(page, perPage, total) });
  },
);

router.get(
  "/admin/payout-batches/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
    if (!batch) {
      respondError(res, 404, "batch_not_found", "Batch not found");
      return;
    }
    const items = await db
      .select({
        id: payoutBatchItemsTable.id,
        payoutId: payoutBatchItemsTable.payoutId,
        amount: payoutBatchItemsTable.amount,
        freelancerId: payoutsTable.freelancerId,
        freelancerName: usersTable.fullName,
        currency: payoutsTable.currency,
        status: payoutsTable.status,
      })
      .from(payoutBatchItemsTable)
      .leftJoin(payoutsTable, eq(payoutBatchItemsTable.payoutId, payoutsTable.id))
      .leftJoin(usersTable, eq(payoutsTable.freelancerId, usersTable.id))
      .where(eq(payoutBatchItemsTable.batchId, batch.id));
    respond(res, { batch, items });
  },
);

router.get(
  "/admin/payout-batches/:id/export.csv",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const [batch] = await db.select().from(payoutBatchesTable).where(eq(payoutBatchesTable.id, id));
    if (!batch) {
      res.status(404).type("text/plain").send("batch_not_found");
      return;
    }
    const items = await db
      .select({
        payoutId: payoutBatchItemsTable.payoutId,
        amount: payoutBatchItemsTable.amount,
        freelancerId: payoutsTable.freelancerId,
        freelancerName: usersTable.fullName,
        freelancerEmail: usersTable.email,
        currency: payoutsTable.currency,
        method: payoutsTable.method,
        reference: payoutsTable.reference,
      })
      .from(payoutBatchItemsTable)
      .leftJoin(payoutsTable, eq(payoutBatchItemsTable.payoutId, payoutsTable.id))
      .leftJoin(usersTable, eq(payoutsTable.freelancerId, usersTable.id))
      .where(eq(payoutBatchItemsTable.batchId, batch.id));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "payout_id,freelancer_id,freelancer_name,freelancer_email,amount,currency,method,reference";
    const lines = items.map((r) =>
      [r.payoutId, r.freelancerId, r.freelancerName, r.freelancerEmail, r.amount, r.currency, r.method, r.reference]
        .map(escape)
        .join(","),
    );
    const csv = [header, ...lines].join("\n");
    res
      .status(200)
      .type("text/csv")
      .setHeader("Content-Disposition", `attachment; filename="batch-${batch.id}.csv"`)
      .send(csv);
  },
);

export default router;
