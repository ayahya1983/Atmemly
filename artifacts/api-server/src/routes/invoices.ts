import { Router, type IRouter } from "express";
import { eq, or, desc } from "drizzle-orm";
import {
  db,
  invoicesTable,
  usersTable,
  jobsTable,
  contractsTable,
  milestonesTable,
  paymentsTable,
} from "@workspace/db";
import {
  ListMyInvoicesResponse,
  GetInvoiceResponse,
  GetInvoiceParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function summarizeInvoice(inv: typeof invoicesTable.$inferSelect) {
  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, inv.clientId));
  const [freelancer] = await db.select().from(usersTable).where(eq(usersTable.id, inv.freelancerId));
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    contractId: inv.contractId,
    milestoneId: inv.milestoneId,
    paymentId: inv.paymentId,
    clientId: inv.clientId,
    clientName: client?.fullName ?? "",
    freelancerId: inv.freelancerId,
    freelancerName: freelancer?.fullName ?? "",
    description: inv.description,
    subtotal: Number(inv.subtotal),
    vatPct: Number(inv.vatPct),
    vatAmount: Number(inv.vatAmount),
    total: Number(inv.total),
    currency: inv.currency,
    issuedAt: inv.issuedAt,
  };
}

router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const role = req.user!.role;
  const where = role === "admin"
    ? undefined
    : or(eq(invoicesTable.clientId, uid), eq(invoicesTable.freelancerId, uid));
  const rows = await db
    .select()
    .from(invoicesTable)
    .where(where)
    .orderBy(desc(invoicesTable.issuedAt))
    .limit(200);
  const out = await Promise.all(rows.map(summarizeInvoice));
  res.json(ListMyInvoicesResponse.parse(out));
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!inv) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (
    req.user!.role !== "admin" &&
    inv.clientId !== req.user!.id &&
    inv.freelancerId !== req.user!.id
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const summary = await summarizeInvoice(inv);
  let jobId: number | null = null;
  let jobTitle: string | null = null;
  let milestoneTitle: string | null = null;
  let paymentStatus: string | null = null;
  if (inv.contractId) {
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, inv.contractId));
    if (c) {
      jobId = c.jobId;
      const [j] = await db.select().from(jobsTable).where(eq(jobsTable.id, c.jobId));
      jobTitle = j?.title ?? null;
    }
  }
  if (inv.milestoneId) {
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, inv.milestoneId));
    milestoneTitle = m?.title ?? null;
  }
  if (inv.paymentId) {
    const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, inv.paymentId));
    paymentStatus = p?.status ?? null;
  }
  res.json(
    GetInvoiceResponse.parse({
      ...summary,
      jobId,
      jobTitle,
      milestoneTitle,
      paymentStatus,
    }),
  );
});

export default router;
