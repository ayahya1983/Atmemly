import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, sql, and, ilike, or, gte, lte, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  contractsTable,
  featuredListingsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";
import { audit } from "../lib/audit";

const router: IRouter = Router();

// ───────────────── Jobs admin v2 ─────────────────

const JobListQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  clientId: z.coerce.number().int().min(1).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/jobs/search",
  requireAuth,
  requirePermission("jobs", "read"),
  async (req, res): Promise<void> => {
    const parsed = JobListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [];
    if (f.status) conds.push(eq(jobsTable.status, f.status));
    if (f.category) conds.push(eq(jobsTable.categorySlug, f.category));
    if (f.clientId) conds.push(eq(jobsTable.clientId, f.clientId));
    if (f.dateFrom) conds.push(gte(jobsTable.createdAt, new Date(f.dateFrom)));
    if (f.dateTo) conds.push(lte(jobsTable.createdAt, new Date(f.dateTo)));
    if (f.q) {
      const like = `%${f.q}%`;
      conds.push(or(ilike(jobsTable.title, like), ilike(jobsTable.description, like))!);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(where);
    const rows = await db
      .select({ j: jobsTable, u: usersTable })
      .from(jobsTable)
      .leftJoin(usersTable, eq(usersTable.id, jobsTable.clientId))
      .where(where)
      .orderBy(desc(jobsTable.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    res.json({
      total,
      limit: f.limit,
      offset: f.offset,
      items: rows.map(({ j, u }) => ({
        id: j.id,
        title: j.title,
        descriptionShort: j.description.slice(0, 220),
        status: j.status,
        categorySlug: j.categorySlug,
        budgetMin: Number(j.budgetMin),
        budgetMax: Number(j.budgetMax),
        currency: j.currency,
        clientId: j.clientId,
        clientName: u?.fullName ?? "",
        createdAt: j.createdAt,
      })),
    });
  },
);

const JobActionBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

const JOB_ACTIONS = {
  approve: { next: "open", audit: "job.approve" },
  reject: { next: "rejected", audit: "job.reject" },
  pause: { next: "paused", audit: "job.pause" },
  close: { next: "closed", audit: "job.close" },
} as const;

type JobActionKey = keyof typeof JOB_ACTIONS | "feature";

router.post(
  "/admin/jobs/:id/:action",
  requireAuth,
  requirePermission("jobs", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const action = String(req.params["action"] ?? "") as JobActionKey;
    const isFeature = action === "feature";
    if (!Number.isFinite(id) || !action || (!isFeature && !(action in JOB_ACTIONS))) {
      res.status(400).json({ error: "invalid params" });
      return;
    }
    const parsed = JobActionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    if (isFeature) {
      // Promote via featured_listings (jobs has no isFeatured column).
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [row] = await db
        .insert(featuredListingsTable)
        .values({
          kind: "job",
          targetId: id,
          sponsorUserId: req.user!.id,
          endsAt,
          note: parsed.data.reason ?? "admin feature",
        })
        .returning();
      await audit(
        req,
        "job.feature",
        "job",
        id,
        { reason: parsed.data.reason ?? null, featuredListingId: row?.id, endsAt },
        { featured: false },
        { featured: true, endsAt },
      );
      res.json({ id, action, featured: true, featuredListingId: row?.id, endsAt });
      return;
    }
    const cfg = JOB_ACTIONS[action];
    const [after] = await db
      .update(jobsTable)
      .set({ status: cfg.next })
      .where(eq(jobsTable.id, id))
      .returning();
    await audit(
      req,
      cfg.audit,
      "job",
      id,
      { reason: parsed.data.reason ?? null },
      { status: before.status },
      { status: after?.status },
    );
    res.json({ id, status: after?.status, action });
  },
);

router.delete(
  "/admin/jobs/:id",
  requireAuth,
  requirePermission("jobs", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (before.status === "deleted") {
      res.status(409).json({ error: "already deleted" });
      return;
    }
    await db.update(jobsTable).set({ status: "deleted" }).where(eq(jobsTable.id, id));
    await audit(req, "job.soft_delete", "job", id, {}, { status: before.status }, { status: "deleted" });
    res.json({ id, status: "deleted" });
  },
);

// ───────────────── Proposals admin ─────────────────

const ProposalListQuery = z.object({
  jobId: z.coerce.number().int().min(1).optional(),
  freelancerId: z.coerce.number().int().min(1).optional(),
  clientId: z.coerce.number().int().min(1).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/proposals",
  requireAuth,
  requirePermission("proposals", "read"),
  async (req, res): Promise<void> => {
    const parsed = ProposalListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [];
    if (f.jobId) conds.push(eq(proposalsTable.jobId, f.jobId));
    if (f.freelancerId) conds.push(eq(proposalsTable.freelancerId, f.freelancerId));
    if (f.status) conds.push(eq(proposalsTable.status, f.status));
    if (f.clientId) conds.push(eq(jobsTable.clientId, f.clientId));
    const where = conds.length ? and(...conds) : undefined;
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(proposalsTable)
      .leftJoin(jobsTable, eq(jobsTable.id, proposalsTable.jobId))
      .where(where);
    const rows = await db
      .select({ p: proposalsTable, j: jobsTable, u: usersTable })
      .from(proposalsTable)
      .leftJoin(jobsTable, eq(jobsTable.id, proposalsTable.jobId))
      .leftJoin(usersTable, eq(usersTable.id, proposalsTable.freelancerId))
      .where(where)
      .orderBy(desc(proposalsTable.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    res.json({
      total,
      limit: f.limit,
      offset: f.offset,
      items: rows.map(({ p, j, u }) => ({
        id: p.id,
        jobId: p.jobId,
        jobTitle: j?.title ?? null,
        freelancerId: p.freelancerId,
        freelancerName: u?.fullName ?? null,
        clientId: j?.clientId ?? null,
        expectedRate: Number(p.expectedRate),
        deliveryDays: p.deliveryDays,
        currency: j?.currency ?? "AED",
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  },
);

const ProposalVisibilityBody = z.object({
  hidden: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

router.patch(
  "/admin/proposals/:id/visibility",
  requireAuth,
  requirePermission("proposals", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = ProposalVisibilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const nextStatus = parsed.data.hidden ? "hidden" : "pending";
    await db.update(proposalsTable).set({ status: nextStatus }).where(eq(proposalsTable.id, id));
    await audit(
      req,
      parsed.data.hidden ? "proposal.hide" : "proposal.unhide",
      "proposal",
      id,
      { reason: parsed.data.reason ?? null },
      { status: before.status },
      { status: nextStatus },
    );
    res.json({ id, status: nextStatus });
  },
);

// ───────────────── Contracts admin extensions ─────────────────

const ContractListQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  freelancerId: z.coerce.number().int().min(1).optional(),
  clientId: z.coerce.number().int().min(1).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/contracts/search",
  requireAuth,
  requirePermission("contracts", "read"),
  async (req, res): Promise<void> => {
    const parsed = ContractListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [];
    if (f.status) conds.push(eq(contractsTable.status, f.status));
    if (f.freelancerId) conds.push(eq(contractsTable.freelancerId, f.freelancerId));
    if (f.clientId) conds.push(eq(contractsTable.clientId, f.clientId));
    if (f.dateFrom) conds.push(gte(contractsTable.createdAt, new Date(f.dateFrom)));
    if (f.dateTo) conds.push(lte(contractsTable.createdAt, new Date(f.dateTo)));
    if (f.q) {
      const like = `%${f.q}%`;
      const asId = Number(f.q);
      const idMatch = Number.isInteger(asId) && asId > 0 ? eq(contractsTable.id, asId) : null;
      const titleMatch = ilike(contractsTable.title, like);
      conds.push(idMatch ? or(idMatch, titleMatch)! : titleMatch);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contractsTable)
      .where(where);
    const rows = await db
      .select()
      .from(contractsTable)
      .where(where)
      .orderBy(desc(contractsTable.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    res.json({
      total,
      limit: f.limit,
      offset: f.offset,
      items: rows.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        clientId: c.clientId,
        freelancerId: c.freelancerId,
        totalAmount: Number(c.totalAmount),
        currency: c.currency,
        createdAt: c.createdAt,
      })),
    });
  },
);

const ContractActionBody = z.object({
  reason: z.string().trim().max(500).optional(),
});
const CONTRACT_ACTIONS = {
  hold: { next: "on_hold", audit: "contract.hold" },
  cancel: { next: "cancelled", audit: "contract.cancel" },
  "mark-disputed": { next: "disputed", audit: "contract.mark_disputed" },
} as const;

router.post(
  "/admin/contracts/:id/:action",
  requireAuth,
  requirePermission("contracts", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const action = String(req.params["action"] ?? "");
    if (!Number.isFinite(id) || !action || !(action in CONTRACT_ACTIONS)) {
      res.status(400).json({ error: "invalid params" });
      return;
    }
    const cfg = CONTRACT_ACTIONS[action as keyof typeof CONTRACT_ACTIONS];
    const parsed = ContractActionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(contractsTable)
      .set({ status: cfg.next })
      .where(eq(contractsTable.id, id))
      .returning();
    await audit(
      req,
      cfg.audit,
      "contract",
      id,
      { reason: parsed.data.reason ?? null },
      { status: before.status },
      { status: after?.status },
    );
    res.json({ id, status: after?.status, action });
  },
);

export default router;
