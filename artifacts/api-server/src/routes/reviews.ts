import { Router, type IRouter } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  db,
  reviewsTable,
  jobsTable,
  usersTable,
  contractsTable,
} from "@workspace/db";
import {
  ListReviewsQueryParams,
  ListReviewsResponse,
  CreateReviewBody,
  CreateReviewResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { audit } from "../lib/audit";
import { notify } from "../lib/notify";

const router: IRouter = Router();

router.get("/reviews", async (req, res): Promise<void> => {
  const parsed = ListReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId } = parsed.data;
  const rows = await db
    .select({ r: reviewsTable, j: jobsTable, u: usersTable })
    .from(reviewsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, reviewsTable.jobId))
    .innerJoin(usersTable, eq(usersTable.id, reviewsTable.fromUserId))
    .where(userId !== undefined ? eq(reviewsTable.toUserId, userId) : undefined)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(100);
  res.json(
    ListReviewsResponse.parse(
      rows.map((row) => ({
        id: row.r.id,
        jobId: row.r.jobId,
        jobTitle: row.j.title,
        fromUserId: row.r.fromUserId,
        fromUserName: row.u.fullName,
        fromUserAvatarUrl: row.u.avatarUrl,
        toUserId: row.r.toUserId,
        rating: row.r.rating,
        comment: row.r.comment,
        createdAt: row.r.createdAt,
      })),
    ),
  );
});

router.get("/reviews/summary", async (req, res): Promise<void> => {
  const userId = Number(req.query["userId"]);
  if (!Number.isFinite(userId)) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  const [agg] = await db
    .select({
      avg: sql<string>`coalesce(avg(rating)::text, '0')`,
      count: sql<number>`count(*)::int`,
      r5: sql<number>`count(*) filter (where rating = 5)::int`,
      r4: sql<number>`count(*) filter (where rating = 4)::int`,
      r3: sql<number>`count(*) filter (where rating = 3)::int`,
      r2: sql<number>`count(*) filter (where rating = 2)::int`,
      r1: sql<number>`count(*) filter (where rating = 1)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, userId));
  res.json({
    userId,
    ratingAvg: Number(agg?.avg ?? 0),
    ratingCount: agg?.count ?? 0,
    distribution: {
      5: agg?.r5 ?? 0,
      4: agg?.r4 ?? 0,
      3: agg?.r3 ?? 0,
      2: agg?.r2 ?? 0,
      1: agg?.r1 ?? 0,
    },
  });
});

router.post("/reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (d.rating < 1 || d.rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, d.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const fromId = req.user!.id;
  // Reviews are now gated to a completed contract between the two parties on this job.
  // This prevents spam/random reviews while keeping the existing data shape.
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(
      and(
        eq(contractsTable.jobId, d.jobId),
        eq(contractsTable.status, "completed"),
        sql`(
          (${contractsTable.clientId} = ${fromId} and ${contractsTable.freelancerId} = ${d.toUserId})
          or
          (${contractsTable.freelancerId} = ${fromId} and ${contractsTable.clientId} = ${d.toUserId})
        )`,
      ),
    );
  if (!contract) {
    res
      .status(403)
      .json({ error: "Reviews require a completed contract between the two parties" });
    return;
  }
  const [existing] = await db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.jobId, d.jobId),
        eq(reviewsTable.fromUserId, fromId),
        eq(reviewsTable.toUserId, d.toUserId),
      ),
    );
  if (existing) {
    res.status(400).json({ error: "Review already exists" });
    return;
  }
  const [review] = await db
    .insert(reviewsTable)
    .values({
      jobId: d.jobId,
      fromUserId: fromId,
      toUserId: d.toUserId,
      rating: d.rating,
      comment: d.comment,
    })
    .returning();
  const [from] = await db.select().from(usersTable).where(eq(usersTable.id, fromId));
  await audit(req, "review.create", "review", review!.id, {
    jobId: d.jobId,
    rating: d.rating,
  });
  await notify({
    userId: d.toUserId,
    kind: "review",
    title: `New ${d.rating}★ review`,
    body: d.comment.slice(0, 120),
    link: "/dashboard/reviews",
  });
  res.json(
    CreateReviewResponse.parse({
      id: review!.id,
      jobId: review!.jobId,
      jobTitle: job.title,
      fromUserId: review!.fromUserId,
      fromUserName: from!.fullName,
      fromUserAvatarUrl: from!.avatarUrl,
      toUserId: review!.toUserId,
      rating: review!.rating,
      comment: review!.comment,
      createdAt: review!.createdAt,
    }),
  );
});

export default router;
