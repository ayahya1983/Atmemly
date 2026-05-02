import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, jobsTable, freelancerProfilesTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import {
  computeMatchScore,
  topFreelancersForJob,
  topJobsForFreelancer,
  similarFreelancers,
} from "../lib/matching";

const router: IRouter = Router();

/** Top jobs for the logged-in freelancer. */
router.get(
  "/me/recommended-jobs",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 50);
    const matches = await topJobsForFreelancer(req.user!.id, limit);
    // Hydrate with job summary
    const out = await Promise.all(
      matches.map(async (m) => {
        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, m.jobId));
        if (!job) return null;
        return {
          job: {
            id: job.id,
            title: job.title,
            categorySlug: job.categorySlug,
            budgetType: job.budgetType,
            budgetMin: Number(job.budgetMin),
            budgetMax: Number(job.budgetMax),
            currency: job.currency,
            skills: job.skills,
            createdAt: job.createdAt,
          },
          score: m.total,
          components: m.components,
        };
      }),
    );
    res.json(out.filter(Boolean));
  },
);

/** Top freelancers across the client's open jobs. */
router.get(
  "/me/recommended-freelancers",
  requireAuth,
  requireRole("client"),
  async (req, res): Promise<void> => {
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 50);
    const myJobs = await db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(and(eq(jobsTable.clientId, req.user!.id), eq(jobsTable.status, "open")));
    if (myJobs.length === 0) {
      res.json([]);
      return;
    }
    const seen = new Map<number, { freelancerId: number; bestScore: number; jobIds: number[] }>();
    for (const j of myJobs.slice(0, 20)) {
      const matches = await topFreelancersForJob(j.id, 10);
      for (const m of matches) {
        const cur = seen.get(m.freelancerId);
        if (!cur) {
          seen.set(m.freelancerId, { freelancerId: m.freelancerId, bestScore: m.total, jobIds: [j.id] });
        } else {
          cur.bestScore = Math.max(cur.bestScore, m.total);
          if (!cur.jobIds.includes(j.id)) cur.jobIds.push(j.id);
        }
      }
    }
    const ranked = [...seen.values()].sort((a, b) => b.bestScore - a.bestScore).slice(0, limit);
    const out = await Promise.all(
      ranked.map(async (r) => {
        const [row] = await db
          .select({ p: freelancerProfilesTable, u: usersTable })
          .from(freelancerProfilesTable)
          .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
          .where(eq(freelancerProfilesTable.userId, r.freelancerId));
        if (!row) return null;
        return {
          freelancer: {
            id: row.u.id,
            fullName: row.u.fullName,
            avatarUrl: row.u.avatarUrl,
            headline: row.p.headline,
            skills: row.p.skills,
            hourlyRate: Number(row.p.hourlyRate),
            currency: row.p.currency,
            location: row.p.location,
            trustScore: row.p.trustScore ?? 0,
          },
          score: r.bestScore,
          matchedJobIds: r.jobIds,
        };
      }),
    );
    res.json(out.filter(Boolean));
  },
);

/** Top freelancers for a specific job (client owner or admin only). */
router.get("/jobs/:id/matches", requireAuth, async (req, res): Promise<void> => {
  const jobId = Number(req.params["id"]);
  if (!Number.isFinite(jobId)) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (req.user!.role !== "admin" && job.clientId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 50);
  const matches = await topFreelancersForJob(jobId, limit);
  const out = await Promise.all(
    matches.map(async (m) => {
      const [row] = await db
        .select({ p: freelancerProfilesTable, u: usersTable })
        .from(freelancerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
        .where(eq(freelancerProfilesTable.userId, m.freelancerId));
      if (!row) return null;
      return {
        freelancer: {
          id: row.u.id,
          fullName: row.u.fullName,
          avatarUrl: row.u.avatarUrl,
          headline: row.p.headline,
          skills: row.p.skills,
          hourlyRate: Number(row.p.hourlyRate),
          currency: row.p.currency,
          location: row.p.location,
          trustScore: row.p.trustScore ?? 0,
        },
        score: m.total,
        components: m.components,
      };
    }),
  );
  res.json(out.filter(Boolean));
});

/** Similar freelancers by skill Jaccard. Public read (no PII besides public profile fields). */
router.get("/freelancers/:id/similar", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query["limit"] ?? 10), 1), 25);
  const sims = await similarFreelancers(id, limit);
  const out = await Promise.all(
    sims.map(async (s) => {
      const [row] = await db
        .select({ p: freelancerProfilesTable, u: usersTable })
        .from(freelancerProfilesTable)
        .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
        .where(eq(freelancerProfilesTable.userId, s.userId));
      if (!row) return null;
      return {
        freelancer: {
          id: row.u.id,
          fullName: row.u.fullName,
          avatarUrl: row.u.avatarUrl,
          headline: row.p.headline,
          skills: row.p.skills,
          hourlyRate: Number(row.p.hourlyRate),
          currency: row.p.currency,
          location: row.p.location,
          trustScore: row.p.trustScore ?? 0,
        },
        similarity: s.score,
      };
    }),
  );
  res.json(out.filter(Boolean));
});

/** Diagnostic: full match breakdown (admin-only). */
router.get(
  "/match/jobs/:jobId/freelancers/:freelancerId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const jobId = Number(req.params["jobId"]);
    const freelancerId = Number(req.params["freelancerId"]);
    if (!Number.isFinite(jobId) || !Number.isFinite(freelancerId)) {
      res.status(400).json({ error: "Invalid ids" });
      return;
    }
    const m = await computeMatchScore(jobId, freelancerId);
    if (!m) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(m);
  },
);

export default router;
