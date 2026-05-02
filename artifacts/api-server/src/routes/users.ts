import { Router, type IRouter } from "express";
import { and, eq, sql, desc, gte, lte, ilike, or } from "drizzle-orm";
import {
  db,
  usersTable,
  freelancerProfilesTable,
  clientProfilesTable,
  jobsTable,
  reviewsTable,
} from "@workspace/db";
import {
  ListFreelancersQueryParams,
  ListFreelancersResponse,
  GetFreelancerParams,
  GetFreelancerResponse,
  UpdateFreelancerProfileBody,
  UpdateFreelancerProfileResponse,
  UpdateClientProfileBody,
  UpdateClientProfileResponse,
  GetClientParams,
  GetClientResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

async function freelancerCard(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const [profile] = await db
    .select()
    .from(freelancerProfilesTable)
    .where(eq(freelancerProfilesTable.userId, userId));
  if (!profile) return null;
  const [agg] = await db
    .select({
      avg: sql<string>`coalesce(avg(rating)::text, '0')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, userId));
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    headline: profile.headline,
    skills: profile.skills,
    hourlyRate: Number(profile.hourlyRate),
    currency: profile.currency,
    ratingAvg: Number(agg?.avg ?? 0),
    ratingCount: agg?.count ?? 0,
    location: profile.location,
    bio: profile.bio,
    portfolio: profile.portfolio ?? [],
  };
}

router.get("/freelancers", async (req, res): Promise<void> => {
  const parsed = ListFreelancersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { q, skill, minRate, maxRate } = parsed.data;
  const conditions = [eq(usersTable.role, "freelancer"), eq(usersTable.status, "active")];
  if (q) {
    conditions.push(
      or(
        ilike(usersTable.fullName, `%${q}%`),
        ilike(freelancerProfilesTable.headline, `%${q}%`),
        ilike(freelancerProfilesTable.bio, `%${q}%`),
      )!,
    );
  }
  if (skill) {
    conditions.push(sql`${freelancerProfilesTable.skills} @> ARRAY[${skill}]::text[]`);
  }
  if (minRate !== undefined) {
    conditions.push(gte(freelancerProfilesTable.hourlyRate, String(minRate)));
  }
  if (maxRate !== undefined) {
    conditions.push(lte(freelancerProfilesTable.hourlyRate, String(maxRate)));
  }

  const rows = await db
    .select({
      user: usersTable,
      profile: freelancerProfilesTable,
    })
    .from(usersTable)
    .innerJoin(freelancerProfilesTable, eq(freelancerProfilesTable.userId, usersTable.id))
    .where(and(...conditions))
    .limit(100);

  const cards = await Promise.all(
    rows.map(async ({ user, profile }) => {
      const [agg] = await db
        .select({
          avg: sql<string>`coalesce(avg(rating)::text, '0')`,
          count: sql<number>`count(*)::int`,
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.toUserId, user.id));
      return {
        id: user.id,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        headline: profile.headline,
        skills: profile.skills,
        hourlyRate: Number(profile.hourlyRate),
        currency: profile.currency,
        ratingAvg: Number(agg?.avg ?? 0),
        ratingCount: agg?.count ?? 0,
        location: profile.location,
      };
    }),
  );

  res.json(ListFreelancersResponse.parse(cards));
});

router.get("/freelancers/:id", async (req, res): Promise<void> => {
  const params = GetFreelancerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const card = await freelancerCard(params.data.id);
  if (!card) {
    res.status(404).json({ error: "Freelancer not found" });
    return;
  }
  const [completed] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(eq(jobsTable.status, "completed"));
  res.json(GetFreelancerResponse.parse({ ...card, completedJobs: completed?.c ?? 0 }));
});

router.put(
  "/profiles/freelancer",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const parsed = UpdateFreelancerProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = req.user!.id;
    const data = parsed.data;
    if (data.fullName !== undefined || data.avatarUrl !== undefined) {
      const updates: { fullName?: string; avatarUrl?: string | null } = {};
      if (data.fullName !== undefined) updates.fullName = data.fullName;
      if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
      await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    }
    const profileUpdates: Record<string, unknown> = {};
    if (data.headline !== undefined) profileUpdates.headline = data.headline;
    if (data.bio !== undefined) profileUpdates.bio = data.bio;
    if (data.skills !== undefined) profileUpdates.skills = data.skills;
    if (data.hourlyRate !== undefined) profileUpdates.hourlyRate = String(data.hourlyRate);
    if (data.location !== undefined) profileUpdates.location = data.location;
    if (data.portfolio !== undefined) profileUpdates.portfolio = data.portfolio;
    if (Object.keys(profileUpdates).length > 0) {
      await db
        .update(freelancerProfilesTable)
        .set(profileUpdates)
        .where(eq(freelancerProfilesTable.userId, userId));
    }
    const card = await freelancerCard(userId);
    if (!card) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const [completed] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.status, "completed"));
    res.json(UpdateFreelancerProfileResponse.parse({ ...card, completedJobs: completed?.c ?? 0 }));
  },
);

async function clientDetail(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  const [profile] = await db
    .select()
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, userId));
  if (!profile) return null;
  const [active] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(eq(jobsTable.clientId, userId), eq(jobsTable.status, "open")));
  const [completed] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(eq(jobsTable.clientId, userId), eq(jobsTable.status, "completed")));
  const [agg] = await db
    .select({
      avg: sql<string>`coalesce(avg(rating)::text, '0')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, userId));
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    companyName: profile.companyName,
    logoUrl: profile.logoUrl,
    overview: profile.overview,
    location: profile.location,
    activeJobs: active?.c ?? 0,
    completedJobs: completed?.c ?? 0,
    ratingAvg: Number(agg?.avg ?? 0),
    ratingCount: agg?.count ?? 0,
  };
}

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const detail = await clientDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(GetClientResponse.parse(detail));
});

router.put(
  "/profiles/client",
  requireAuth,
  requireRole("client"),
  async (req, res): Promise<void> => {
    const parsed = UpdateClientProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = req.user!.id;
    const data = parsed.data;
    if (data.fullName !== undefined || data.avatarUrl !== undefined) {
      const updates: { fullName?: string; avatarUrl?: string | null } = {};
      if (data.fullName !== undefined) updates.fullName = data.fullName;
      if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl;
      await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    }
    const profileUpdates: Record<string, unknown> = {};
    if (data.companyName !== undefined) profileUpdates.companyName = data.companyName;
    if (data.logoUrl !== undefined) profileUpdates.logoUrl = data.logoUrl;
    if (data.overview !== undefined) profileUpdates.overview = data.overview;
    if (data.location !== undefined) profileUpdates.location = data.location;
    if (Object.keys(profileUpdates).length > 0) {
      await db
        .update(clientProfilesTable)
        .set(profileUpdates)
        .where(eq(clientProfilesTable.userId, userId));
    }
    const detail = await clientDetail(userId);
    if (!detail) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(UpdateClientProfileResponse.parse(detail));
  },
);

// Avoid unused-import warnings in some configs
void desc;

export default router;
