import { Router, type IRouter } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  db,
  proposalsTable,
  jobsTable,
  usersTable,
  freelancerProfilesTable,
  notificationsTable,
  reviewsTable,
} from "@workspace/db";
import {
  ListProposalsQueryParams,
  ListProposalsResponse,
  CreateProposalBody,
  CreateProposalResponse,
  UpdateProposalStatusParams,
  UpdateProposalStatusBody,
  UpdateProposalStatusResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

async function buildProposalDetail(id: number) {
  const [row] = await db
    .select({
      p: proposalsTable,
      j: jobsTable,
      u: usersTable,
      fp: freelancerProfilesTable,
    })
    .from(proposalsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, proposalsTable.jobId))
    .innerJoin(usersTable, eq(usersTable.id, proposalsTable.freelancerId))
    .leftJoin(freelancerProfilesTable, eq(freelancerProfilesTable.userId, proposalsTable.freelancerId))
    .where(eq(proposalsTable.id, id));
  if (!row) return null;
  const [agg] = await db
    .select({ avg: sql<string>`coalesce(avg(rating)::text, '0')` })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, row.u.id));
  return {
    id: row.p.id,
    jobId: row.p.jobId,
    freelancerId: row.p.freelancerId,
    coverLetter: row.p.coverLetter,
    expectedRate: Number(row.p.expectedRate),
    deliveryDays: row.p.deliveryDays,
    portfolioLinks: row.p.portfolioLinks,
    status: row.p.status,
    createdAt: row.p.createdAt,
    freelancerName: row.u.fullName,
    freelancerAvatarUrl: row.u.avatarUrl,
    freelancerHeadline: row.fp?.headline ?? null,
    freelancerRatingAvg: Number(agg?.avg ?? 0),
    jobTitle: row.j.title,
    jobBudgetMin: Number(row.j.budgetMin),
    jobBudgetMax: Number(row.j.budgetMax),
    jobCurrency: row.j.currency,
  };
}

router.get("/proposals", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListProposalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, mine } = parsed.data;
  const conditions = [];
  if (jobId !== undefined) {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
    if (!job) {
      res.json(ListProposalsResponse.parse([]));
      return;
    }
    if (
      req.user!.role !== "admin" &&
      job.clientId !== req.user!.id &&
      req.user!.role !== "freelancer"
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    conditions.push(eq(proposalsTable.jobId, jobId));
  }
  if (mine) conditions.push(eq(proposalsTable.freelancerId, req.user!.id));
  const ids = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(proposalsTable.createdAt))
    .limit(200);
  const rows = await Promise.all(ids.map((r) => buildProposalDetail(r.id)));
  res.json(ListProposalsResponse.parse(rows.filter(Boolean)));
});

router.post(
  "/proposals",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const parsed = CreateProposalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, d.jobId));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.status !== "open") {
      res.status(400).json({ error: "Job not open" });
      return;
    }
    const [existing] = await db
      .select()
      .from(proposalsTable)
      .where(
        and(eq(proposalsTable.jobId, d.jobId), eq(proposalsTable.freelancerId, req.user!.id)),
      );
    if (existing) {
      res.status(400).json({ error: "Already applied" });
      return;
    }
    const [proposal] = await db
      .insert(proposalsTable)
      .values({
        jobId: d.jobId,
        freelancerId: req.user!.id,
        coverLetter: d.coverLetter,
        expectedRate: String(d.expectedRate),
        deliveryDays: d.deliveryDays,
        portfolioLinks: d.portfolioLinks ?? [],
        status: "pending",
      })
      .returning();
    if (!proposal) {
      res.status(500).json({ error: "Failed" });
      return;
    }
    await db.insert(notificationsTable).values({
      userId: job.clientId,
      kind: "proposal",
      title: "New proposal received",
      body: `${req.user!.fullName} submitted a proposal on "${job.title}"`,
      link: `/dashboard/client/jobs/${job.id}/proposals`,
    });
    res.json(
      CreateProposalResponse.parse({
        id: proposal.id,
        jobId: proposal.jobId,
        freelancerId: proposal.freelancerId,
        coverLetter: proposal.coverLetter,
        expectedRate: Number(proposal.expectedRate),
        deliveryDays: proposal.deliveryDays,
        portfolioLinks: proposal.portfolioLinks,
        status: proposal.status,
        createdAt: proposal.createdAt,
      }),
    );
  },
);

router.patch(
  "/proposals/:id/status",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateProposalStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateProposalStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select({ p: proposalsTable, j: jobsTable })
      .from(proposalsTable)
      .innerJoin(jobsTable, eq(jobsTable.id, proposalsTable.jobId))
      .where(eq(proposalsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Proposal not found" });
      return;
    }
    const role = req.user!.role;
    const isOwnerClient = existing.j.clientId === req.user!.id;
    const isFreelancerOwner = existing.p.freelancerId === req.user!.id;
    const newStatus = parsed.data.status;
    if (newStatus === "withdrawn") {
      if (!isFreelancerOwner) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    } else {
      if (role !== "admin" && !isOwnerClient) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const [updated] = await db
      .update(proposalsTable)
      .set({ status: newStatus })
      .where(eq(proposalsTable.id, params.data.id))
      .returning();
    if (newStatus === "accepted") {
      await db
        .update(jobsTable)
        .set({ status: "in_progress" })
        .where(eq(jobsTable.id, existing.j.id));
    }
    await db.insert(notificationsTable).values({
      userId: existing.p.freelancerId,
      kind: "proposal_status",
      title: `Proposal ${newStatus}`,
      body: `Your proposal on "${existing.j.title}" was ${newStatus}.`,
      link: `/dashboard/freelancer/proposals`,
    });
    res.json(
      UpdateProposalStatusResponse.parse({
        id: updated!.id,
        jobId: updated!.jobId,
        freelancerId: updated!.freelancerId,
        coverLetter: updated!.coverLetter,
        expectedRate: Number(updated!.expectedRate),
        deliveryDays: updated!.deliveryDays,
        portfolioLinks: updated!.portfolioLinks,
        status: updated!.status,
        createdAt: updated!.createdAt,
      }),
    );
  },
);

export default router;
