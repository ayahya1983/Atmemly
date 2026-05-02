import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  db,
  jobsTable,
  freelancerProfilesTable,
  usersTable,
  reviewsTable,
} from "@workspace/db";

/**
 * Phase 3 matching service. Returns a 0..100 score for a job ↔ freelancer pair.
 *
 * Weights:
 *   - Skills overlap   40
 *   - Budget fit       15
 *   - Trust score      20
 *   - Rating count     10
 *   - Location/cat fit 10
 *   - Recency          5
 */
export interface MatchBreakdown {
  jobId: number;
  freelancerId: number;
  total: number;
  components: {
    skills: number;
    budget: number;
    trust: number;
    ratingCount: number;
    locationCategory: number;
    recency: number;
  };
}

function intersect<T>(a: T[], b: T[]): T[] {
  const sb = new Set(b.map((x) => String(x).toLowerCase()));
  return a.filter((x) => sb.has(String(x).toLowerCase()));
}

export async function computeMatchScore(
  jobId: number,
  freelancerId: number,
): Promise<MatchBreakdown | null> {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return null;
  const [profile] = await db
    .select({ p: freelancerProfilesTable, u: usersTable })
    .from(freelancerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
    .where(eq(freelancerProfilesTable.userId, freelancerId));
  if (!profile) return null;

  // Skills (40)
  const overlap = intersect(job.skills ?? [], profile.p.skills ?? []);
  const denom = Math.max(1, (job.skills ?? []).length);
  const skillsScore = Math.round((overlap.length / denom) * 40);

  // Budget fit (15)
  const rate = Number(profile.p.hourlyRate ?? 0);
  const minB = Number(job.budgetMin ?? 0);
  const maxB = Number(job.budgetMax ?? 0);
  let budgetScore = 0;
  if (job.budgetType === "hourly") {
    if (maxB > 0 && rate > 0 && rate <= maxB && rate >= minB) budgetScore = 15;
    else if (maxB > 0 && rate <= maxB * 1.2) budgetScore = 8;
    else budgetScore = 3;
  } else {
    // fixed: assume freelancer can handle if their rate * 8h fits within budget
    const proxyDay = rate * 8;
    if (maxB === 0) budgetScore = 8;
    else if (proxyDay <= maxB) budgetScore = 15;
    else if (proxyDay <= maxB * 1.5) budgetScore = 8;
    else budgetScore = 3;
  }

  // Trust (20) — direct from denormalized score / 5
  const trustScore = Math.min(20, Math.round((profile.p.trustScore ?? 0) / 5));

  // Rating count (10)
  const [agg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, freelancerId));
  const reviewCount = Number(agg?.count ?? 0);
  const ratingCountScore = Math.min(10, reviewCount);

  // Location/category fit (10)
  let locCatScore = 0;
  // category: skills-aligned to category proxied via skill match (already counted), give 5 for any city match
  const fLocLower = (profile.p.location ?? "").toLowerCase();
  if (fLocLower.includes("uae") || fLocLower.includes("dubai") || fLocLower.includes("abu dhabi")) {
    locCatScore += 5;
  }
  // give 5 if freelancer skills include any token of categorySlug
  if (
    job.categorySlug &&
    (profile.p.skills ?? []).some((s) =>
      s.toLowerCase().includes(job.categorySlug.toLowerCase()),
    )
  ) {
    locCatScore += 5;
  }

  // Recency (5) — newer profile activity (proxy: profile.lastScoreAt within 30d gets boost)
  const last = profile.p.lastScoreAt instanceof Date ? profile.p.lastScoreAt.getTime() : 0;
  const ageDays = last > 0 ? (Date.now() - last) / (1000 * 60 * 60 * 24) : 999;
  const recencyScore = ageDays < 30 ? 5 : ageDays < 90 ? 2 : 0;

  const total = Math.max(
    0,
    Math.min(
      100,
      skillsScore + budgetScore + trustScore + ratingCountScore + locCatScore + recencyScore,
    ),
  );

  return {
    jobId,
    freelancerId,
    total,
    components: {
      skills: skillsScore,
      budget: budgetScore,
      trust: trustScore,
      ratingCount: ratingCountScore,
      locationCategory: locCatScore,
      recency: recencyScore,
    },
  };
}

/** Top N freelancers for a given job, ordered by match score. */
export async function topFreelancersForJob(
  jobId: number,
  limit = 10,
): Promise<MatchBreakdown[]> {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return [];

  // Candidate pool: active freelancers with at least one overlapping skill OR top trust.
  const candidates = await db
    .select({ uid: freelancerProfilesTable.userId })
    .from(freelancerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
    .where(
      and(
        eq(usersTable.role, "freelancer"),
        eq(usersTable.status, "active"),
        ne(usersTable.id, job.clientId),
      ),
    )
    .orderBy(desc(freelancerProfilesTable.trustScore))
    .limit(100);

  const scored = (
    await Promise.all(candidates.map((c) => computeMatchScore(jobId, c.uid)))
  ).filter((x): x is MatchBreakdown => x != null);

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, limit);
}

/** Top N jobs for a given freelancer. */
export async function topJobsForFreelancer(
  freelancerId: number,
  limit = 10,
): Promise<MatchBreakdown[]> {
  // Candidate jobs: open, recent.
  const candidates = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.status, "open"))
    .orderBy(desc(jobsTable.createdAt))
    .limit(100);

  const scored = (
    await Promise.all(candidates.map((j) => computeMatchScore(j.id, freelancerId)))
  ).filter((x): x is MatchBreakdown => x != null);

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, limit);
}

/** Similar freelancers by skill-set Jaccard. */
export async function similarFreelancers(
  freelancerId: number,
  limit = 10,
): Promise<Array<{ userId: number; score: number; skills: string[] }>> {
  const [me] = await db
    .select()
    .from(freelancerProfilesTable)
    .where(eq(freelancerProfilesTable.userId, freelancerId));
  if (!me) return [];
  const mySkills = new Set((me.skills ?? []).map((s) => s.toLowerCase()));
  if (mySkills.size === 0) return [];

  const others = await db
    .select({ p: freelancerProfilesTable, u: usersTable })
    .from(freelancerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, freelancerProfilesTable.userId))
    .where(and(eq(usersTable.role, "freelancer"), eq(usersTable.status, "active")));
  const out: Array<{ userId: number; score: number; skills: string[] }> = [];
  for (const r of others) {
    if (r.p.userId === freelancerId) continue;
    const theirs = new Set((r.p.skills ?? []).map((s) => s.toLowerCase()));
    if (theirs.size === 0) continue;
    let inter = 0;
    for (const s of mySkills) if (theirs.has(s)) inter++;
    const union = mySkills.size + theirs.size - inter;
    const jaccard = union > 0 ? inter / union : 0;
    if (jaccard > 0) {
      out.push({
        userId: r.p.userId,
        score: Math.round(jaccard * 100),
        skills: r.p.skills ?? [],
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

// Re-export for callers that want raw db helpers.
export { inArray };
