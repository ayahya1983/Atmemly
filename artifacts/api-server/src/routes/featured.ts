import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import { db, featuredListingsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";

const router: IRouter = Router();

const CreateBody = z.object({
  kind: z.enum(["job", "freelancer"]),
  targetId: z.number().int().positive(),
  sponsorUserId: z.number().int().positive().optional(),
  paymentId: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime(),
  note: z.string().max(500).optional(),
});

router.get("/featured", async (req, res): Promise<void> => {
  const kind = req.query["kind"];
  const now = new Date();
  const conditions = [
    lte(featuredListingsTable.startsAt, now),
    gte(featuredListingsTable.endsAt, now),
  ];
  if (kind === "job" || kind === "freelancer") {
    conditions.push(eq(featuredListingsTable.kind, kind));
  }
  const rows = await db
    .select()
    .from(featuredListingsTable)
    .where(and(...conditions))
    .orderBy(desc(featuredListingsTable.startsAt))
    .limit(100);
  respond(res, rows);
});

router.post(
  "/admin/featured",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : new Date();
    const endsAt = new Date(parsed.data.endsAt);
    if (endsAt <= startsAt) {
      respondError(res, 400, "invalid_range", "endsAt must be after startsAt");
      return;
    }
    const [row] = await db
      .insert(featuredListingsTable)
      .values({
        kind: parsed.data.kind,
        targetId: parsed.data.targetId,
        sponsorUserId: parsed.data.sponsorUserId ?? null,
        paymentId: parsed.data.paymentId ?? null,
        startsAt,
        endsAt,
        note: parsed.data.note ?? null,
      })
      .returning();
    respond(res, row);
  },
);

router.delete(
  "/admin/featured/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const deleted = await db
      .delete(featuredListingsTable)
      .where(eq(featuredListingsTable.id, id))
      .returning({ id: featuredListingsTable.id });
    if (deleted.length === 0) {
      respondError(res, 404, "not_found", "Featured listing not found");
      return;
    }
    respond(res, { id });
  },
);

router.get(
  "/admin/featured",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(featuredListingsTable)
      .orderBy(desc(featuredListingsTable.createdAt))
      .limit(200);
    const [{ active }] = (await db
      .select({
        active: sql<number>`cast(sum(case when starts_at <= now() and ends_at >= now() then 1 else 0 end) as int)`,
      })
      .from(featuredListingsTable)) as Array<{ active: number }>;
    respond(res, rows, { activeCount: active });
  },
);

export default router;
