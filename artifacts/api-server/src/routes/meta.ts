import { Router, type IRouter } from "express";
import { sql, eq, and } from "drizzle-orm";
import {
  db,
  categoriesTable,
  skillsTable,
  jobsTable,
  usersTable,
  proposalsTable,
  paymentsTable,
} from "@workspace/db";
import {
  ListCategoriesResponse,
  ListSkillsResponse,
  GetMarketplaceStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/meta/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.nameEn);
  res.json(ListCategoriesResponse.parse(rows));
});

router.get("/meta/skills", async (_req, res): Promise<void> => {
  const rows = await db.select().from(skillsTable).orderBy(skillsTable.name);
  res.json(ListSkillsResponse.parse(rows));
});

router.get("/meta/stats", async (_req, res): Promise<void> => {
  const [activeJobs] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(eq(jobsTable.status, "open"));
  const [completedJobs] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(eq(jobsTable.status, "completed"));
  const [totalFreelancers] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "freelancer"));
  const [totalClients] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.role, "client"));
  const [totalProposals] = await db.select({ c: sql<number>`count(*)::int` }).from(proposalsTable);
  const [paid] = await db
    .select({ s: sql<string>`coalesce(sum(amount), 0)::text` })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.status, "succeeded"), eq(paymentsTable.currency, "AED")));

  res.json(
    GetMarketplaceStatsResponse.parse({
      activeJobs: activeJobs?.c ?? 0,
      totalFreelancers: totalFreelancers?.c ?? 0,
      totalClients: totalClients?.c ?? 0,
      totalProposals: totalProposals?.c ?? 0,
      completedJobs: completedJobs?.c ?? 0,
      totalPaidAed: Number(paid?.s ?? 0),
    }),
  );
});

export default router;
