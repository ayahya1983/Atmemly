import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  savedSearchesTable,
  savedSearchAlertsTable,
  jobsTable,
  type SavedSearchQuery,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";
import { notify } from "../lib/notify";

const router: IRouter = Router();

const QuerySchema = z.object({
  q: z.string().max(200).nullable().optional(),
  category: z.string().max(64).nullable().optional(),
  skill: z.string().max(64).nullable().optional(),
  budgetType: z.enum(["fixed", "hourly"]).nullable().optional(),
  minBudget: z.number().nonnegative().nullable().optional(),
  maxBudget: z.number().nonnegative().nullable().optional(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  query: QuerySchema,
  notify: z.boolean().optional().default(true),
});

function publicRow(r: typeof savedSearchesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    query: r.query as SavedSearchQuery,
    notify: r.notify,
    lastRunAt: r.lastRunAt,
    lastNotifiedJobId: r.lastNotifiedJobId,
    createdAt: r.createdAt,
  };
}

router.get("/me/saved-searches", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(savedSearchesTable)
    .where(eq(savedSearchesTable.userId, req.user!.id))
    .orderBy(desc(savedSearchesTable.createdAt));
  res.json(rows.map(publicRow));
});

router.post("/me/saved-searches", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(savedSearchesTable)
    .values({
      userId: req.user!.id,
      name: parsed.data.name,
      query: parsed.data.query as SavedSearchQuery,
      notify: parsed.data.notify ?? true,
    })
    .returning();
  await audit(req, "saved_search.create", "saved_search", row!.id, {
    name: row!.name,
    notify: row!.notify,
  });
  res.json(publicRow(row!));
});

router.delete("/me/saved-searches/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db
    .delete(savedSearchesTable)
    .where(and(eq(savedSearchesTable.id, id), eq(savedSearchesTable.userId, req.user!.id)))
    .returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await audit(req, "saved_search.delete", "saved_search", id);
  res.json({ ok: true });
});

function buildJobConditionsFromQuery(q: SavedSearchQuery, sinceJobId?: number) {
  const conditions = [eq(jobsTable.status, "open")];
  if (q.q) {
    conditions.push(
      or(
        ilike(jobsTable.title, `%${q.q}%`),
        ilike(jobsTable.description, `%${q.q}%`),
      )!,
    );
  }
  if (q.category) conditions.push(eq(jobsTable.categorySlug, q.category));
  if (q.budgetType) conditions.push(eq(jobsTable.budgetType, q.budgetType));
  if (q.minBudget != null) conditions.push(gte(jobsTable.budgetMin, String(q.minBudget)));
  if (q.maxBudget != null) conditions.push(lte(jobsTable.budgetMax, String(q.maxBudget)));
  if (q.skill) {
    conditions.push(sql`${jobsTable.skills} @> ARRAY[${q.skill}]::text[]`);
  }
  if (sinceJobId != null) conditions.push(gt(jobsTable.id, sinceJobId));
  return conditions;
}

router.get("/me/saved-searches/:id/preview", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(savedSearchesTable)
    .where(and(eq(savedSearchesTable.id, id), eq(savedSearchesTable.userId, req.user!.id)));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const conditions = buildJobConditionsFromQuery(row.query as SavedSearchQuery);
  const jobs = await db
    .select()
    .from(jobsTable)
    .where(and(...conditions))
    .orderBy(desc(jobsTable.createdAt))
    .limit(50);
  res.json(
    jobs.map((j) => ({
      id: j.id,
      title: j.title,
      categorySlug: j.categorySlug,
      budgetType: j.budgetType,
      budgetMin: Number(j.budgetMin),
      budgetMax: Number(j.budgetMax),
      currency: j.currency,
      skills: j.skills,
      createdAt: j.createdAt,
    })),
  );
});

/**
 * Admin sweep: walks every active saved search, queries jobs newer than the
 * search's last seen jobId, dedups via saved_search_alerts, and notifies the
 * subscriber if `notify=true`.
 */
router.post(
  "/admin/saved-searches/run",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const all = await db.select().from(savedSearchesTable);
    let searchesScanned = 0;
    let matchesNew = 0;
    let notificationsSent = 0;
    const PAGE = 100;
    const MAX_PAGES_PER_SEARCH = 20; // safety cap → 2,000 jobs/sweep/search
    for (const s of all) {
      searchesScanned++;
      let cursor = s.lastNotifiedJobId ?? 0;
      let totalFreshForSearch = 0;
      const titlesForNotify: string[] = [];
      let pagesProcessed = 0;
      // Walk ascending by id from lastNotifiedJobId to never lose a match
      // even when more than PAGE jobs accumulate between sweeps.
      while (pagesProcessed < MAX_PAGES_PER_SEARCH) {
        pagesProcessed++;
        const conds = buildJobConditionsFromQuery(s.query as SavedSearchQuery, cursor);
        const page = await db
          .select({ id: jobsTable.id, title: jobsTable.title })
          .from(jobsTable)
          .where(and(...conds))
          .orderBy(asc(jobsTable.id))
          .limit(PAGE);
        if (page.length === 0) break;
        // Race-safe insert via UNIQUE(saved_search_id, job_id) + ON CONFLICT DO NOTHING.
        const inserted = await db
          .insert(savedSearchAlertsTable)
          .values(page.map((j) => ({ savedSearchId: s.id, jobId: j.id })))
          .onConflictDoNothing()
          .returning({ jobId: savedSearchAlertsTable.jobId });
        const insertedSet = new Set(inserted.map((r) => r.jobId));
        const fresh = page.filter((j) => insertedSet.has(j.id));
        totalFreshForSearch += fresh.length;
        for (const j of fresh) {
          if (titlesForNotify.length < 3) titlesForNotify.push(j.title);
        }
        cursor = page[page.length - 1]!.id;
        if (page.length < PAGE) break;
      }
      matchesNew += totalFreshForSearch;
      if (totalFreshForSearch > 0 && s.notify) {
        await notify({
          userId: s.userId,
          kind: "job_alert",
          title: `${totalFreshForSearch} new job${totalFreshForSearch > 1 ? "s" : ""} for "${s.name}"`,
          body: titlesForNotify.map((t) => `• ${t}`).join("\n"),
          link: `/jobs?savedSearch=${s.id}`,
        });
        notificationsSent++;
      }
      await db
        .update(savedSearchesTable)
        .set({
          lastRunAt: new Date(),
          ...(cursor > (s.lastNotifiedJobId ?? 0) ? { lastNotifiedJobId: cursor } : {}),
        })
        .where(eq(savedSearchesTable.id, s.id));
    }
    await audit(req, "saved_search.sweep", "saved_search", null, {
      searchesScanned,
      matchesNew,
      notificationsSent,
    });
    res.json({ searchesScanned, matchesNew, notificationsSent });
  },
);

export default router;
