import { and, eq } from "drizzle-orm";
import {
  db,
  contractsTable,
  milestonesTable,
  paymentsTable,
  paymentTransactionsTable,
  type PaymentTransaction,
} from "@workspace/db";
import { addPendingBalance, generateInvoice } from "../escrow";
import { recordEscrowEvent } from "../escrowEvents";
import { notify } from "../notify";
import { logger } from "../logger";

/**
 * Idempotently promote a payment_transactions row from
 * INITIATED/PENDING/REQUIRES_ACTION to ESCROW_HELD when the gateway
 * confirms payment. If the PT is anchored to a milestone, we run the
 * existing escrow-funding ladder (create payments row, generate
 * invoice, credit freelancer pending balance, transition contract,
 * record escrow_event).
 *
 * Safe to call multiple times — the conditional UPDATE on
 * payment_transactions.status acts as the idempotency claim.
 *
 * Returns true if THIS call was the one that did the funding,
 * false if the PT was already PAID/ESCROW_HELD.
 */
export async function markTransactionPaidAndFundEscrow(opts: {
  transaction: PaymentTransaction;
  gatewayReference?: string | null;
  reason?: string;
}): Promise<boolean> {
  const tx = opts.transaction;

  if (tx.status === "ESCROW_HELD" || tx.status === "PAID" || tx.status === "RELEASED") {
    return false;
  }

  // Conditional claim — only one concurrent caller wins.
  const claimed = await db
    .update(paymentTransactionsTable)
    .set({
      status: "PAID",
      gatewayReference: opts.gatewayReference ?? tx.gatewayReference,
      capturedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentTransactionsTable.id, tx.id),
        eq(paymentTransactionsTable.status, tx.status),
      ),
    )
    .returning({ id: paymentTransactionsTable.id });
  if (claimed.length === 0) {
    // Lost the race — another worker is processing this transaction.
    return false;
  }

  // No milestone anchor → nothing more to do (subscription / featured /
  // other purposes don't move escrow money).
  if (!tx.milestoneId || tx.paymentPurpose !== "milestone_funding") {
    return true;
  }

  const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, tx.milestoneId));
  if (!m) {
    logger.warn({ transactionId: tx.id, milestoneId: tx.milestoneId }, "PT paid but milestone missing");
    return true;
  }
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
  if (!contract) {
    logger.warn({ transactionId: tx.id, contractId: m.contractId }, "PT paid but contract missing");
    return true;
  }

  if (m.status !== "pending_funding") {
    // Already funded (e.g. via legacy /milestones/:id/fund). Mark PT as
    // ESCROW_HELD anyway so the user-facing transaction list is correct.
    await db
      .update(paymentTransactionsTable)
      .set({ status: "ESCROW_HELD", updatedAt: new Date() })
      .where(eq(paymentTransactionsTable.id, tx.id));
    return true;
  }

  const amount = Number(m.amount);
  const feePct = Number(contract.platformFeePct);
  const feeAmount = Math.round(amount * (feePct / 100) * 100) / 100;
  const netAmount = Math.round((amount - feeAmount) * 100) / 100;
  const invoiceNumberShort = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  let paymentId = 0;
  let invoiceId = 0;
  await db.transaction(async (trx) => {
    const claimedM = await trx
      .update(milestonesTable)
      .set({ status: "funded", fundedAt: new Date() })
      .where(
        and(
          eq(milestonesTable.id, m.id),
          eq(milestonesTable.status, "pending_funding"),
        ),
      )
      .returning({ id: milestonesTable.id });
    if (claimedM.length === 0) {
      // Lost the race against /milestones/:id/fund — fine, just bail.
      return;
    }
    const [payment] = await trx
      .insert(paymentsTable)
      .values({
        jobId: contract.jobId,
        payerId: contract.clientId,
        payeeId: contract.freelancerId,
        contractId: contract.id,
        milestoneId: m.id,
        amount: String(amount),
        currency: contract.currency,
        platformFeePct: String(feePct),
        platformFeeAmount: String(feeAmount),
        freelancerNetAmount: String(netAmount),
        status: "held",
        invoiceNumber: invoiceNumberShort,
        stripeIntentId: opts.gatewayReference ?? tx.gatewayReference ?? null,
        heldAt: new Date(),
      })
      .returning();
    paymentId = payment!.id;
    const inv = await generateInvoice(
      {
        contractId: contract.id,
        milestoneId: m.id,
        paymentId: payment!.id,
        clientId: contract.clientId,
        freelancerId: contract.freelancerId,
        description: `${contract.title} — ${m.title}`,
        subtotal: amount,
        currency: contract.currency,
      },
      trx,
    );
    invoiceId = inv.id;
    await trx
      .update(milestonesTable)
      .set({ paymentId: payment!.id })
      .where(eq(milestonesTable.id, m.id));
    if (contract.status === "pending_client_payment") {
      await trx
        .update(contractsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(
          and(
            eq(contractsTable.id, contract.id),
            eq(contractsTable.status, "pending_client_payment"),
          ),
        );
    }
    await addPendingBalance(
      contract.freelancerId,
      amount,
      contract.currency,
      "milestone",
      m.id,
      `Funded via ${tx.gateway}: ${m.title}`,
      trx,
    );
    await trx
      .update(paymentTransactionsTable)
      .set({
        status: "ESCROW_HELD",
        paymentId: payment!.id,
        invoiceId: inv.id,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactionsTable.id, tx.id));
    await recordEscrowEvent(
      {
        contractId: contract.id,
        milestoneId: m.id,
        paymentId: payment!.id,
        fromState: "pending_funding",
        toState: "held",
        amount,
        currency: contract.currency,
        actorUserId: tx.userId,
        reason: opts.reason ?? `funded via ${tx.gateway}`,
        metadata: { transactionId: tx.id },
      },
      trx,
    );
  });

  if (paymentId > 0) {
    await notify({
      userId: contract.freelancerId,
      kind: "milestone",
      title: "Milestone funded",
      body: `Client funded "${m.title}" via ${tx.gateway} — you can start work.`,
      link: `/dashboard/freelancer/contracts/${contract.id}`,
    });
  }
  void invoiceId;
  return true;
}
