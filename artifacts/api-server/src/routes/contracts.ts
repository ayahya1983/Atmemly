import { Router, type IRouter } from "express";
import { and, eq, desc, asc, or, sql } from "drizzle-orm";
import {
  db,
  contractsTable,
  milestonesTable,
  deliverablesTable,
  jobsTable,
  usersTable,
  paymentsTable,
  notificationsTable,
  invoicesTable,
} from "@workspace/db";
import {
  ListMyContractsResponse,
  GetContractResponse,
  GetContractParams,
  UpdateContractParams,
  UpdateContractBody,
  UpdateContractResponse,
  ListMilestonesParams,
  ListMilestonesResponse,
  CreateMilestoneParams,
  CreateMilestoneBody,
  CreateMilestoneResponse,
  FundMilestoneParams,
  FundMilestoneResponse,
  SubmitMilestoneDeliverableParams,
  SubmitMilestoneDeliverableBody,
  SubmitMilestoneDeliverableResponse,
  ApproveMilestoneParams,
  ApproveMilestoneResponse,
  RequestMilestoneRevisionParams,
  RequestMilestoneRevisionBody,
  RequestMilestoneRevisionResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";
import {
  ensureWallet,
  addPendingBalance,
  releaseToWallet,
  generateInvoice,
} from "../lib/escrow";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

type ContractRow = typeof contractsTable.$inferSelect;

async function contractSummary(c: ContractRow) {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, c.jobId));
  const [client] = await db.select().from(usersTable).where(eq(usersTable.id, c.clientId));
  const [freelancer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, c.freelancerId));
  const [agg] = await db
    .select({
      milestoneCount: sql<number>`count(*)::int`,
      funded: sql<string>`coalesce(sum(case when ${milestonesTable.status} in ('funded','in_progress','submitted','revision_requested','approved') then ${milestonesTable.amount} else 0 end), 0)::text`,
      released: sql<string>`coalesce(sum(case when ${milestonesTable.status} = 'released' then ${milestonesTable.amount} else 0 end), 0)::text`,
    })
    .from(milestonesTable)
    .where(eq(milestonesTable.contractId, c.id));
  return {
    id: c.id,
    jobId: c.jobId,
    jobTitle: job?.title ?? "",
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
    milestoneCount: agg?.milestoneCount ?? 0,
    fundedAmount: Number(agg?.funded ?? 0),
    releasedAmount: Number(agg?.released ?? 0),
  };
}

async function milestoneDetail(m: typeof milestonesTable.$inferSelect) {
  const deliverables = await db
    .select({
      d: deliverablesTable,
      u: usersTable,
    })
    .from(deliverablesTable)
    .leftJoin(usersTable, eq(usersTable.id, deliverablesTable.freelancerId))
    .where(eq(deliverablesTable.milestoneId, m.id))
    .orderBy(desc(deliverablesTable.submittedAt));
  let invoiceId: number | null = null;
  let invoiceNumber: string | null = null;
  if (m.paymentId) {
    const [inv] = await db
      .select({ id: invoicesTable.id, n: invoicesTable.invoiceNumber })
      .from(invoicesTable)
      .where(eq(invoicesTable.paymentId, m.paymentId));
    if (inv) {
      invoiceId = inv.id;
      invoiceNumber = inv.n;
    }
  }
  return {
    id: m.id,
    contractId: m.contractId,
    title: m.title,
    description: m.description,
    amount: Number(m.amount),
    currency: m.currency,
    dueDate: m.dueDate,
    status: m.status,
    sortOrder: m.sortOrder,
    fundedAt: m.fundedAt,
    submittedAt: m.submittedAt,
    approvedAt: m.approvedAt,
    releasedAt: m.releasedAt,
    paymentId: m.paymentId,
    invoiceId,
    invoiceNumber,
    deliverables: deliverables.map(({ d, u }) => ({
      id: d.id,
      milestoneId: d.milestoneId,
      freelancerId: d.freelancerId,
      freelancerName: u?.fullName ?? "",
      message: d.message,
      files: d.files,
      revisionNumber: d.revisionNumber,
      submittedAt: d.submittedAt,
    })),
    createdAt: m.createdAt,
  };
}

async function loadContractWithMilestones(id: number) {
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!c) return null;
  const summary = await contractSummary(c);
  const ms = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.contractId, id))
    .orderBy(asc(milestonesTable.sortOrder), asc(milestonesTable.id));
  const milestones = await Promise.all(ms.map(milestoneDetail));
  return {
    ...summary,
    scope: c.scope,
    cancelledAt: c.cancelledAt,
    cancellationReason: c.cancellationReason,
    completedAt: c.completedAt,
    milestones,
  };
}

function isPartyOrAdmin(c: ContractRow, userId: number, role: string): boolean {
  if (role === "admin") return true;
  return c.clientId === userId || c.freelancerId === userId;
}

router.get("/contracts", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const role = req.user!.role;
  const where = role === "admin"
    ? undefined
    : or(eq(contractsTable.clientId, uid), eq(contractsTable.freelancerId, uid));
  const rows = await db
    .select()
    .from(contractsTable)
    .where(where)
    .orderBy(desc(contractsTable.createdAt))
    .limit(200);
  const out = await Promise.all(rows.map(contractSummary));
  res.json(ListMyContractsResponse.parse(out));
});

router.get("/contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!c) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  if (!isPartyOrAdmin(c, req.user!.id, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const detail = await loadContractWithMilestones(c.id);
  res.json(GetContractResponse.parse(detail!));
});

router.patch("/contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateContractParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateContractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!c) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  const role = req.user!.role;
  const isClient = c.clientId === req.user!.id;
  const isAdmin = role === "admin";
  if (!isClient && !isAdmin) {
    res.status(403).json({ error: "Only the client or admin can modify the contract" });
    return;
  }
  if (parsed.data.action === "cancel") {
    if (!["draft", "pending_client_payment", "active", "submitted_for_review", "revision_requested"].includes(c.status)) {
      res.status(400).json({ error: "Contract cannot be cancelled in current state" });
      return;
    }
    // Only block cancel if any milestone is funded but not released and we're not admin
    if (!isAdmin) {
      const blockers = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(milestonesTable)
        .where(
          and(
            eq(milestonesTable.contractId, c.id),
            sql`${milestonesTable.status} in ('funded','in_progress','submitted','revision_requested','approved')`,
          ),
        );
      if ((blockers[0]?.c ?? 0) > 0) {
        res.status(400).json({ error: "Cannot cancel a contract with funded milestones — request a refund or admin action" });
        return;
      }
    }
    await db
      .update(contractsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.user!.id,
        cancellationReason: parsed.data.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(contractsTable.id, c.id));
    await audit(req, "contract.cancel", "contract", c.id, {
      reason: parsed.data.reason ?? null,
      by: req.user!.id,
    });
  } else if (parsed.data.action === "complete") {
    const [pending] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(milestonesTable)
      .where(
        and(
          eq(milestonesTable.contractId, c.id),
          sql`${milestonesTable.status} <> 'released' and ${milestonesTable.status} <> 'cancelled'`,
        ),
      );
    if ((pending?.c ?? 0) > 0) {
      res.status(400).json({ error: "All milestones must be released before completion" });
      return;
    }
    await db
      .update(contractsTable)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(contractsTable.id, c.id));
    await db.update(jobsTable).set({ status: "completed" }).where(eq(jobsTable.id, c.jobId));
    await audit(req, "contract.complete", "contract", c.id);
  }
  const detail = await loadContractWithMilestones(c.id);
  res.json(UpdateContractResponse.parse(detail!));
});

router.get("/contracts/:id/milestones", requireAuth, async (req, res): Promise<void> => {
  const params = ListMilestonesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
  if (!c) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  if (!isPartyOrAdmin(c, req.user!.id, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const ms = await db
    .select()
    .from(milestonesTable)
    .where(eq(milestonesTable.contractId, c.id))
    .orderBy(asc(milestonesTable.sortOrder), asc(milestonesTable.id));
  const out = await Promise.all(ms.map(milestoneDetail));
  res.json(ListMilestonesResponse.parse(out));
});

router.post(
  "/contracts/:id/milestones",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = CreateMilestoneParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateMilestoneBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, params.data.id));
    if (!c) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    if (req.user!.role !== "admin" && c.clientId !== req.user!.id) {
      res.status(403).json({ error: "Only the client can add milestones" });
      return;
    }
    if (c.contractType !== "fixed_price") {
      res.status(400).json({ error: "Milestones are only for fixed_price contracts" });
      return;
    }
    if (["completed", "cancelled", "disputed"].includes(c.status)) {
      res.status(400).json({ error: "Contract is closed" });
      return;
    }
    const [agg] = await db
      .select({ next: sql<number>`coalesce(max(${milestonesTable.sortOrder}), -1) + 1` })
      .from(milestonesTable)
      .where(eq(milestonesTable.contractId, c.id));
    const [created] = await db
      .insert(milestonesTable)
      .values({
        contractId: c.id,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        amount: String(parsed.data.amount),
        currency: c.currency,
        dueDate: parsed.data.dueDate ?? null,
        status: "pending_funding",
        sortOrder: agg?.next ?? 0,
      })
      .returning();
    await audit(req, "milestone.create", "milestone", created!.id, { contractId: c.id });
    const detail = await milestoneDetail(created!);
    res.json(CreateMilestoneResponse.parse(detail));
  },
);

router.post(
  "/milestones/:id/fund",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = FundMilestoneParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id));
    if (!m) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!c) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    if (req.user!.role !== "admin" && c.clientId !== req.user!.id) {
      res.status(403).json({ error: "Only the client can fund milestones" });
      return;
    }
    if (m.status !== "pending_funding") {
      res.status(400).json({ error: "Milestone is not awaiting funding" });
      return;
    }
    const amount = Number(m.amount);
    const stripeIntentId = `pi_mock_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const invoiceNumberShort = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const feePct = Number(c.platformFeePct);
    const feeAmount = Math.round(amount * (feePct / 100) * 100) / 100;
    const netAmount = Math.round((amount - feeAmount) * 100) / 100;
    let paymentId = 0;
    let invoiceId = 0;
    try {
      await db.transaction(async (tx) => {
        // Conditional state transition: only proceed if milestone is still pending_funding.
        // Returning() yields nothing if some concurrent request already funded it.
        const claimed = await tx
          .update(milestonesTable)
          .set({ status: "funded", fundedAt: new Date() })
          .where(
            and(
              eq(milestonesTable.id, m.id),
              eq(milestonesTable.status, "pending_funding"),
            ),
          )
          .returning({ id: milestonesTable.id });
        if (claimed.length === 0) {
          throw Object.assign(new Error("Milestone state changed concurrently"), {
            code: "STATE_CONFLICT",
          });
        }
        const [payment] = await tx
          .insert(paymentsTable)
          .values({
            jobId: c.jobId,
            payerId: c.clientId,
            payeeId: c.freelancerId,
            contractId: c.id,
            milestoneId: m.id,
            amount: String(amount),
            currency: c.currency,
            platformFeePct: String(feePct),
            platformFeeAmount: String(feeAmount),
            freelancerNetAmount: String(netAmount),
            status: "held",
            invoiceNumber: invoiceNumberShort,
            stripeIntentId,
            heldAt: new Date(),
          })
          .returning();
        paymentId = payment!.id;
        const inv = await generateInvoice(
          {
            contractId: c.id,
            milestoneId: m.id,
            paymentId: payment!.id,
            clientId: c.clientId,
            freelancerId: c.freelancerId,
            description: `${c.title} — ${m.title}`,
            subtotal: amount,
            currency: c.currency,
          },
          tx,
        );
        invoiceId = inv.id;
        await tx
          .update(milestonesTable)
          .set({ paymentId: payment!.id })
          .where(eq(milestonesTable.id, m.id));
        if (c.status === "pending_client_payment") {
          await tx
            .update(contractsTable)
            .set({ status: "active", updatedAt: new Date() })
            .where(
              and(
                eq(contractsTable.id, c.id),
                eq(contractsTable.status, "pending_client_payment"),
              ),
            );
        }
        await addPendingBalance(
          c.freelancerId,
          amount,
          c.currency,
          "milestone",
          m.id,
          `Funded: ${m.title}`,
          tx,
        );
        await tx.insert(notificationsTable).values({
          userId: c.freelancerId,
          kind: "milestone",
          title: "Milestone funded",
          body: `Client funded "${m.title}" — you can start work.`,
          link: `/dashboard/freelancer/contracts/${c.id}`,
        });
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "STATE_CONFLICT") {
        res.status(409).json({ error: "Milestone is no longer awaiting funding" });
        return;
      }
      throw e;
    }
    await audit(req, "milestone.fund", "milestone", m.id, {
      contractId: c.id,
      paymentId,
      invoiceId,
      amount,
    });
    const updated = await db.select().from(milestonesTable).where(eq(milestonesTable.id, m.id));
    res.json(FundMilestoneResponse.parse(await milestoneDetail(updated[0]!)));
  },
);

router.post(
  "/milestones/:id/submit",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const params = SubmitMilestoneDeliverableParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SubmitMilestoneDeliverableBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id));
    if (!m) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!c) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    if (c.freelancerId !== req.user!.id) {
      res.status(403).json({ error: "Only the contracted freelancer can submit" });
      return;
    }
    if (!["funded", "in_progress", "revision_requested"].includes(m.status)) {
      res.status(400).json({ error: "Milestone cannot accept a submission in current state" });
      return;
    }
    try {
      await db.transaction(async (tx) => {
        const claimed = await tx
          .update(milestonesTable)
          .set({ status: "submitted", submittedAt: new Date() })
          .where(
            and(
              eq(milestonesTable.id, m.id),
              sql`${milestonesTable.status} in ('funded','in_progress','revision_requested')`,
            ),
          )
          .returning({ id: milestonesTable.id });
        if (claimed.length === 0) {
          throw Object.assign(new Error("Milestone state changed concurrently"), {
            code: "STATE_CONFLICT",
          });
        }
        const [agg] = await tx
          .select({ next: sql<number>`coalesce(max(${deliverablesTable.revisionNumber}), 0) + 1` })
          .from(deliverablesTable)
          .where(eq(deliverablesTable.milestoneId, m.id));
        await tx.insert(deliverablesTable).values({
          milestoneId: m.id,
          freelancerId: req.user!.id,
          message: parsed.data.message,
          files: parsed.data.files ?? [],
          revisionNumber: agg?.next ?? 1,
        });
        await tx
          .update(contractsTable)
          .set({ status: "submitted_for_review", updatedAt: new Date() })
          .where(eq(contractsTable.id, c.id));
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "STATE_CONFLICT") {
        res.status(409).json({ error: "Milestone state changed; refresh and retry" });
        return;
      }
      throw e;
    }
    await db.insert(notificationsTable).values({
      userId: c.clientId,
      kind: "milestone",
      title: "Deliverable submitted",
      body: `${req.user!.fullName} submitted work for "${m.title}".`,
      link: `/dashboard/client/contracts/${c.id}`,
    });
    await audit(req, "milestone.submit", "milestone", m.id, { contractId: c.id });
    const updated = await db.select().from(milestonesTable).where(eq(milestonesTable.id, m.id));
    res.json(SubmitMilestoneDeliverableResponse.parse(await milestoneDetail(updated[0]!)));
  },
);

router.post(
  "/milestones/:id/approve",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = ApproveMilestoneParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id));
    if (!m) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!c) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    if (req.user!.role !== "admin" && c.clientId !== req.user!.id) {
      res.status(403).json({ error: "Only the client can approve" });
      return;
    }
    if (m.status !== "submitted") {
      res.status(400).json({ error: "Only submitted milestones can be approved" });
      return;
    }
    const amount = Number(m.amount);
    const feePct = Number(c.platformFeePct);
    try {
      await db.transaction(async (tx) => {
        // Atomic claim: only the first concurrent caller transitions submitted → released.
        const claimed = await tx
          .update(milestonesTable)
          .set({
            status: "released",
            approvedAt: new Date(),
            releasedAt: new Date(),
          })
          .where(
            and(
              eq(milestonesTable.id, m.id),
              eq(milestonesTable.status, "submitted"),
            ),
          )
          .returning({ id: milestonesTable.id });
        if (claimed.length === 0) {
          throw Object.assign(new Error("Milestone state changed concurrently"), {
            code: "STATE_CONFLICT",
          });
        }
        // releaseToWallet has its own guarded UPDATE that throws if pending balance is short.
        await releaseToWallet(
          c.freelancerId,
          amount,
          feePct,
          c.currency,
          "milestone",
          m.id,
          tx,
        );
        if (m.paymentId) {
          await tx
            .update(paymentsTable)
            .set({ status: "released", releasedAt: new Date() })
            .where(
              and(
                eq(paymentsTable.id, m.paymentId),
                eq(paymentsTable.status, "held"),
              ),
            );
        }
        // Auto-complete contract if all milestones released (computed inside tx for consistency).
        const [pending] = await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(milestonesTable)
          .where(
            and(
              eq(milestonesTable.contractId, c.id),
              sql`${milestonesTable.status} <> 'released' and ${milestonesTable.status} <> 'cancelled'`,
            ),
          );
        if ((pending?.c ?? 0) === 0) {
          await tx
            .update(contractsTable)
            .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
            .where(eq(contractsTable.id, c.id));
          await tx
            .update(jobsTable)
            .set({ status: "completed" })
            .where(eq(jobsTable.id, c.jobId));
        } else {
          await tx
            .update(contractsTable)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(contractsTable.id, c.id));
        }
      });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "STATE_CONFLICT") {
        res.status(409).json({ error: "Milestone is no longer awaiting approval" });
        return;
      }
      throw e;
    }
    await db.insert(notificationsTable).values({
      userId: c.freelancerId,
      kind: "payment",
      title: "Milestone approved & payment released",
      body: `Client approved "${m.title}". Funds were released to your wallet.`,
      link: "/dashboard/freelancer/earnings",
    });
    await audit(req, "milestone.approve", "milestone", m.id, {
      contractId: c.id,
      releasedAmount: amount,
      feePct,
    });
    const updated = await db.select().from(milestonesTable).where(eq(milestonesTable.id, m.id));
    res.json(ApproveMilestoneResponse.parse(await milestoneDetail(updated[0]!)));
  },
);

router.post(
  "/milestones/:id/request-revision",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = RequestMilestoneRevisionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = RequestMilestoneRevisionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, params.data.id));
    if (!m) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!c) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }
    if (req.user!.role !== "admin" && c.clientId !== req.user!.id) {
      res.status(403).json({ error: "Only the client can request revisions" });
      return;
    }
    if (m.status !== "submitted") {
      res.status(400).json({ error: "Revision can only be requested on submitted work" });
      return;
    }
    const claimed = await db
      .update(milestonesTable)
      .set({ status: "revision_requested" })
      .where(
        and(
          eq(milestonesTable.id, m.id),
          eq(milestonesTable.status, "submitted"),
        ),
      )
      .returning({ id: milestonesTable.id });
    if (claimed.length === 0) {
      res.status(409).json({ error: "Milestone state changed; refresh and retry" });
      return;
    }
    await db
      .update(contractsTable)
      .set({ status: "revision_requested", updatedAt: new Date() })
      .where(eq(contractsTable.id, c.id));
    await db.insert(notificationsTable).values({
      userId: c.freelancerId,
      kind: "milestone",
      title: "Revision requested",
      body: `Client requested a revision for "${m.title}": ${parsed.data.reason}`,
      link: `/dashboard/freelancer/contracts/${c.id}`,
    });
    await audit(req, "milestone.request_revision", "milestone", m.id, {
      contractId: c.id,
      reason: parsed.data.reason,
    });
    const updated = await db.select().from(milestonesTable).where(eq(milestonesTable.id, m.id));
    res.json(RequestMilestoneRevisionResponse.parse(await milestoneDetail(updated[0]!)));
  },
);

export default router;
