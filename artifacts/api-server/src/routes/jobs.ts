import { Router, type IRouter } from "express";
import { and, eq, sql, desc, gte, lte, ilike, or } from "drizzle-orm";
import {
  db,
  jobsTable,
  usersTable,
  clientProfilesTable,
  proposalsTable,
  categoriesTable,
  savedJobsTable,
} from "@workspace/db";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  CreateJobResponse,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
  CompleteJobParams,
  CompleteJobResponse,
  ListSavedJobsResponse,
  SaveJobParams,
  UnsaveJobParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole, attachUser } from "../lib/auth";

const router: IRouter = Router();

async function buildJobCard(jobId: number) {
  const [row] = await db
    .select({
      job: jobsTable,
      client: usersTable,
      profile: clientProfilesTable,
    })
    .from(jobsTable)
    .innerJoin(usersTable, eq(usersTable.id, jobsTable.clientId))
    .leftJoin(clientProfilesTable, eq(clientProfilesTable.userId, jobsTable.clientId))
    .where(eq(jobsTable.id, jobId));
  if (!row) return null;
  const [count] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(proposalsTable)
    .where(eq(proposalsTable.jobId, jobId));
  const [cat] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, row.job.categorySlug));
  return {
    id: row.job.id,
    title: row.job.title,
    descriptionShort: row.job.description.slice(0, 220),
    description: row.job.description,
    categorySlug: row.job.categorySlug,
    categoryNameEn: cat?.nameEn ?? row.job.categorySlug,
    categoryNameAr: cat?.nameAr ?? row.job.categorySlug,
    budgetType: row.job.budgetType,
    budgetMin: Number(row.job.budgetMin),
    budgetMax: Number(row.job.budgetMax),
    currency: row.job.currency,
    skills: row.job.skills,
    status: row.job.status,
    deadline: row.job.deadline,
    createdAt: row.job.createdAt,
    proposalCount: count?.c ?? 0,
    clientId: row.client.id,
    clientName: row.client.fullName,
    clientCompany: row.profile?.companyName ?? null,
    clientLogoUrl: row.profile?.logoUrl ?? null,
  };
}

router.get("/jobs", attachUser, async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { q, category, skill, budgetType, minBudget, maxBudget, mine } = parsed.data;
  const sort =
    typeof req.query["sort"] === "string" ? (req.query["sort"] as string) : "newest";
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 100), 1), 200);
  const offset = Math.max(Number(req.query["offset"] ?? 0), 0);
  const conditions = [];
  if (q) {
    conditions.push(or(ilike(jobsTable.title, `%${q}%`), ilike(jobsTable.description, `%${q}%`))!);
  }
  if (category) conditions.push(eq(jobsTable.categorySlug, category));
  if (budgetType) conditions.push(eq(jobsTable.budgetType, budgetType));
  if (minBudget !== undefined) conditions.push(gte(jobsTable.budgetMin, String(minBudget)));
  if (maxBudget !== undefined) conditions.push(lte(jobsTable.budgetMax, String(maxBudget)));
  if (skill) conditions.push(sql`${jobsTable.skills} @> ARRAY[${skill}]::text[]`);
  if (mine && req.user) {
    conditions.push(eq(jobsTable.clientId, req.user.id));
  }
  let orderBy;
  if (sort === "budget_high") {
    orderBy = sql`${jobsTable.budgetMax} DESC NULLS LAST, ${jobsTable.createdAt} DESC`;
  } else if (sort === "relevance" && q) {
    // Title matches rank above description matches; fall back to recency.
    orderBy = sql`(case when ${jobsTable.title} ilike ${"%" + q + "%"} then 0 else 1 end), ${jobsTable.createdAt} DESC`;
  } else {
    orderBy = desc(jobsTable.createdAt);
  }
  const rows = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
  const cards = await Promise.all(rows.map((r) => buildJobCard(r.id)));
  res.json(ListJobsResponse.parse(cards.filter(Boolean)));
});

router.post(
  "/jobs",
  requireAuth,
  requireRole("client"),
  async (req, res): Promise<void> => {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [job] = await db
      .insert(jobsTable)
      .values({
        clientId: req.user!.id,
        title: d.title,
        description: d.description,
        categorySlug: d.categorySlug,
        budgetType: d.budgetType,
        budgetMin: String(d.budgetMin),
        budgetMax: String(d.budgetMax),
        currency: d.currency ?? "AED",
        skills: d.skills,
        deadline: d.deadline ? new Date(d.deadline) : null,
        status: "open",
      })
      .returning();
    if (!job) {
      res.status(500).json({ error: "Failed to create job" });
      return;
    }
    res.json(
      CreateJobResponse.parse({
        id: job.id,
        title: job.title,
        description: job.description,
        categorySlug: job.categorySlug,
        budgetType: job.budgetType,
        budgetMin: Number(job.budgetMin),
        budgetMax: Number(job.budgetMax),
        currency: job.currency,
        skills: job.skills,
        status: job.status,
        deadline: job.deadline,
        createdAt: job.createdAt,
        clientId: job.clientId,
      }),
    );
  },
);

router.get("/jobs/:id", attachUser, async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const card = await buildJobCard(params.data.id);
  if (!card) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  let saved = false;
  if (req.user) {
    const [s] = await db
      .select()
      .from(savedJobsTable)
      .where(and(eq(savedJobsTable.userId, req.user.id), eq(savedJobsTable.jobId, params.data.id)));
    saved = !!s;
  }
  res.json(GetJobResponse.parse({ ...card, saved }));
});

router.patch(
  "/jobs/:id",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateJobBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (req.user!.role !== "admin" && existing.clientId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.title !== undefined) updates.title = d.title;
    if (d.description !== undefined) updates.description = d.description;
    if (d.categorySlug !== undefined) updates.categorySlug = d.categorySlug;
    if (d.budgetType !== undefined) updates.budgetType = d.budgetType;
    if (d.budgetMin !== undefined) updates.budgetMin = String(d.budgetMin);
    if (d.budgetMax !== undefined) updates.budgetMax = String(d.budgetMax);
    if (d.currency !== undefined) updates.currency = d.currency;
    if (d.skills !== undefined) updates.skills = d.skills;
    if (d.deadline !== undefined) updates.deadline = d.deadline ? new Date(d.deadline) : null;
    if (d.status !== undefined) updates.status = d.status;

    const [job] = await db
      .update(jobsTable)
      .set(updates)
      .where(eq(jobsTable.id, params.data.id))
      .returning();
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(
      UpdateJobResponse.parse({
        id: job.id,
        title: job.title,
        description: job.description,
        categorySlug: job.categorySlug,
        budgetType: job.budgetType,
        budgetMin: Number(job.budgetMin),
        budgetMax: Number(job.budgetMax),
        currency: job.currency,
        skills: job.skills,
        status: job.status,
        deadline: job.deadline,
        createdAt: job.createdAt,
        clientId: job.clientId,
      }),
    );
  },
);

router.delete(
  "/jobs/:id",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = DeleteJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (req.user!.role !== "admin" && existing.clientId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id));
    res.sendStatus(204);
  },
);

router.post(
  "/jobs/:id/complete",
  requireAuth,
  requireRole("client", "admin"),
  async (req, res): Promise<void> => {
    const params = CompleteJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (req.user!.role !== "admin" && existing.clientId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [job] = await db
      .update(jobsTable)
      .set({ status: "completed" })
      .where(eq(jobsTable.id, params.data.id))
      .returning();
    res.json(
      CompleteJobResponse.parse({
        id: job!.id,
        title: job!.title,
        description: job!.description,
        categorySlug: job!.categorySlug,
        budgetType: job!.budgetType,
        budgetMin: Number(job!.budgetMin),
        budgetMax: Number(job!.budgetMax),
        currency: job!.currency,
        skills: job!.skills,
        status: job!.status,
        deadline: job!.deadline,
        createdAt: job!.createdAt,
        clientId: job!.clientId,
      }),
    );
  },
);

router.get(
  "/saved-jobs",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const rows = await db
      .select({ jobId: savedJobsTable.jobId })
      .from(savedJobsTable)
      .where(eq(savedJobsTable.userId, req.user!.id))
      .orderBy(desc(savedJobsTable.createdAt));
    const cards = await Promise.all(rows.map((r) => buildJobCard(r.jobId)));
    res.json(ListSavedJobsResponse.parse(cards.filter(Boolean)));
  },
);

router.post(
  "/saved-jobs/:jobId",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const params = SaveJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .insert(savedJobsTable)
      .values({ userId: req.user!.id, jobId: params.data.jobId })
      .onConflictDoNothing();
    res.sendStatus(204);
  },
);

router.delete(
  "/saved-jobs/:jobId",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const params = UnsaveJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    await db
      .delete(savedJobsTable)
      .where(
        and(eq(savedJobsTable.userId, req.user!.id), eq(savedJobsTable.jobId, params.data.jobId)),
      );
    res.sendStatus(204);
  },
);

export default router;
