import { Router, type IRouter } from "express";
import { eq, or, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  paymentsTable,
  jobsTable,
  proposalsTable,
  usersTable,
} from "@workspace/db";
import {
  ListPaymentsResponse,
  CreatePaymentIntentBody,
  CreatePaymentIntentResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { notify } from "../lib/notify";

const router: IRouter = Router();

async function paymentRowToPayment(p: typeof paymentsTable.$inferSelect) {
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
}

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const rows = await db
    .select()
    .from(paymentsTable)
    .where(or(eq(paymentsTable.payerId, uid), eq(paymentsTable.payeeId, uid)))
    .orderBy(desc(paymentsTable.createdAt));
  const out = await Promise.all(rows.map(paymentRowToPayment));
  res.json(ListPaymentsResponse.parse(out));
});

router.post(
  "/payments/create-intent",
  requireAuth,
  requireRole("client"),
  async (req, res): Promise<void> => {
    const parsed = CreatePaymentIntentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { jobId, proposalId, amount, currency } = parsed.data;
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.clientId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [proposal] = await db
      .select()
      .from(proposalsTable)
      .where(eq(proposalsTable.id, proposalId));
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const stripeIntentId = `pi_mock_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const [payment] = await db
      .insert(paymentsTable)
      .values({
        jobId,
        payerId: req.user!.id,
        payeeId: proposal.freelancerId,
        amount: String(amount),
        currency: currency ?? "AED",
        status: "succeeded",
        invoiceNumber,
        stripeIntentId,
      })
      .returning();
    await db
      .update(jobsTable)
      .set({ status: "completed" })
      .where(eq(jobsTable.id, jobId));
    await notify({
      userId: proposal.freelancerId,
      kind: "payment",
      title: "Payment received",
      body: `You received ${currency ?? "AED"} ${amount} for "${job.title}"`,
      link: "/dashboard/freelancer/earnings",
    });
    res.json(
      CreatePaymentIntentResponse.parse({
        paymentId: payment!.id,
        clientSecret: `${stripeIntentId}_secret_mock`,
        amount: Number(payment!.amount),
        currency: payment!.currency,
        status: payment!.status,
      }),
    );
  },
);

export default router;
