import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, reviewsTable, jobsTable, usersTable } from "@workspace/db";
import {
  ListReviewsQueryParams,
  ListReviewsResponse,
  CreateReviewBody,
  CreateReviewResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

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
  const [existing] = await db
    .select()
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.jobId, d.jobId),
        eq(reviewsTable.fromUserId, req.user!.id),
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
      fromUserId: req.user!.id,
      toUserId: d.toUserId,
      rating: d.rating,
      comment: d.comment,
    })
    .returning();
  const [from] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
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
