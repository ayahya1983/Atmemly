import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  milestonesTable,
  contractsTable,
  paymentsTable,
  escrowEventsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";
import { recordEscrowEvent, type EscrowState } from "../lib/escrowEvents";
import { releaseToWallet, debitPending } from "../lib/escrow";
import { audit } from "../lib/audit";

const router: IRouter = Router();

router.get(
  "/admin/escrow/events",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const milestoneId = req.query["milestoneId"] ? Number(req.query["milestoneId"]) : null;
    const contractId = req.query["contractId"] ? Number(req.query["contractId"]) : null;
    const conditions = [];
    if (milestoneId) conditions.push(eq(escrowEventsTable.milestoneId, milestoneId));
    if (contractId) conditions.push(eq(escrowEventsTable.contractId, contractId));
    const rows = conditions.length
      ? await db.select().from(escrowEventsTable).where(and(...conditions)).orderBy(desc(escrowEventsTable.createdAt)).limit(200)
      : await db.select().from(escrowEventsTable).orderBy(desc(escrowEventsTable.createdAt)).limit(200);
    respond(res, rows);
  },
);

const PartialReleaseBody = z.object({
  amount: z.number().positive(),
  reason: z.string().max(500).optional(),
});

router.post(
  "/admin/escrow/milestones/:id/partial-release",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      respondError(res, 400, "invalid_id", "Invalid milestone id");
      return;
    }
    const parsed = PartialReleaseBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
    if (!m) {
      respondError(res, 404, "milestone_not_found", "Milestone not found");
      return;
    }
    const held = Number(m.amount);
    if (parsed.data.amount > held) {
      respondError(res, 400, "amount_exceeds_held", `Amount exceeds held (${held})`);
      return;
    }
    if (m.status !== "funded" && m.status !== "submitted") {
      respondError(res, 409, "invalid_state", `Milestone is ${m.status}; must be funded or submitted`);
      return;
    }
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!contract) {
      respondError(res, 404, "contract_not_found", "Parent contract missing");
      return;
    }
    try {
      await db.transaction(async (tx) => {
        const feePct = Number(contract.platformFeePct);
        await releaseToWallet(
          contract.freelancerId,
          parsed.data.amount,
          feePct,
          m.currency,
          "milestone_partial",
          m.id,
          tx,
        );
        // Decrement the held amount so a subsequent normal approve/release
        // only acts on the remainder. Without this the approve handler in
        // routes/contracts.ts would attempt to release the full original
        // amount and fail on `pendingBalance >= grossAmount`.
        const remaining = Math.round((Number(m.amount) - parsed.data.amount) * 100) / 100;
        await tx
          .update(milestonesTable)
          .set({
            amount: String(remaining),
            escrowState: remaining > 0 ? "partial_released" : "released",
            ...(remaining === 0 ? { status: "released" } : {}),
          })
          .where(eq(milestonesTable.id, m.id));
        await recordEscrowEvent(
          {
            contractId: contract.id,
            milestoneId: m.id,
            paymentId: m.paymentId,
            fromState: m.escrowState,
            toState: (remaining > 0 ? "partial_released" : "released") as EscrowState,
            amount: parsed.data.amount,
            currency: m.currency,
            actorUserId: req.user!.id,
            reason: parsed.data.reason ?? null,
            metadata: { feePct, remainingHeld: remaining, originalAmount: held },
          },
          tx,
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "release failed";
      respondError(res, 409, "release_failed", message);
      return;
    }
    await audit(req, "escrow.partial_release", "milestone", m.id, {
      amount: parsed.data.amount,
      currency: m.currency,
    });
    respond(res, { milestoneId: m.id, released: parsed.data.amount, currency: m.currency, escrowState: "partial_released" });
  },
);

const RefundBody = z.object({ reason: z.string().max(500).optional() });

router.post(
  "/admin/escrow/milestones/:id/refund",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
    if (!m) {
      respondError(res, 404, "milestone_not_found", "Milestone not found");
      return;
    }
    if (m.status === "released" || m.status === "refunded") {
      respondError(res, 409, "invalid_state", `Milestone is already ${m.status}`);
      return;
    }
    const parsed = RefundBody.safeParse(req.body ?? {});
    const reason = parsed.success ? parsed.data.reason ?? null : null;
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!contract) {
      respondError(res, 404, "contract_not_found", "Parent contract missing");
      return;
    }
    const refundAmount = Number(m.amount);
    try {
      await db.transaction(async (tx) => {
        // Reverse the freelancer's pending escrow credit FIRST. If this fails
        // the whole refund aborts so we never leave wallet/escrow desynced.
        if (refundAmount > 0) {
          const ok = await debitPending(
            contract.freelancerId,
            refundAmount,
            m.currency,
            "milestone_refund",
            m.id,
            reason ?? `Refund of milestone ${m.id}`,
            tx,
          );
          if (!ok) {
            throw new Error(
              `Cannot refund: insufficient pending balance for freelancer ${contract.freelancerId} (need ${refundAmount}). Some funds may already have been released.`,
            );
          }
        }
        await tx
          .update(milestonesTable)
          .set({ status: "refunded", escrowState: "refunded" })
          .where(eq(milestonesTable.id, m.id));
        if (m.paymentId) {
          await tx
            .update(paymentsTable)
            .set({ status: "refunded", refundedAt: new Date() })
            .where(eq(paymentsTable.id, m.paymentId));
        }
        await recordEscrowEvent(
          {
            contractId: m.contractId,
            milestoneId: m.id,
            paymentId: m.paymentId,
            fromState: m.escrowState,
            toState: "refunded",
            amount: refundAmount,
            currency: m.currency,
            actorUserId: req.user!.id,
            reason,
          },
          tx,
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "refund failed";
      respondError(res, 409, "refund_failed", message);
      return;
    }
    await audit(req, "escrow.refund", "milestone", m.id, {
      amount: Number(m.amount),
      currency: m.currency,
    });
    respond(res, { milestoneId: m.id, escrowState: "refunded" });
  },
);

router.post(
  "/admin/escrow/milestones/:id/hold-for-dispute",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, id));
    if (!m) {
      respondError(res, 404, "milestone_not_found", "Milestone not found");
      return;
    }
    await db
      .update(milestonesTable)
      .set({ escrowState: "dispute_held" })
      .where(eq(milestonesTable.id, m.id));
    await recordEscrowEvent({
      contractId: m.contractId,
      milestoneId: m.id,
      paymentId: m.paymentId,
      fromState: m.escrowState,
      toState: "dispute_held",
      amount: Number(m.amount),
      currency: m.currency,
      actorUserId: req.user!.id,
      reason: "manual hold",
    });
    respond(res, { milestoneId: m.id, escrowState: "dispute_held" });
  },
);

export default router;
