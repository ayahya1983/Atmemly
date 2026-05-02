import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, moderationReportsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError, parsePagination, paginate } from "../lib/apiResponse";

const router: IRouter = Router();

const ReportBody = z.object({
  targetKind: z.enum(["job", "profile", "review", "message", "proposal"]),
  targetId: z.number().int().positive(),
  reason: z.string().min(2).max(120),
  details: z.string().max(2000).optional(),
});

router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const parsed = ReportBody.safeParse(req.body);
  if (!parsed.success) {
    respondError(res, 400, "validation_error", parsed.error.message);
    return;
  }
  const [row] = await db
    .insert(moderationReportsTable)
    .values({
      targetKind: parsed.data.targetKind,
      targetId: parsed.data.targetId,
      reporterUserId: req.user!.id,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    })
    .returning();
  respond(res, row);
});

router.get("/me/reports", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(moderationReportsTable)
    .where(eq(moderationReportsTable.reporterUserId, req.user!.id))
    .orderBy(desc(moderationReportsTable.createdAt))
    .limit(100);
  respond(res, rows);
});

router.get(
  "/admin/moderation",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { page, perPage, offset } = parsePagination(req.query as Record<string, unknown>);
    const status = typeof req.query["status"] === "string" ? req.query["status"] : null;
    const kind = typeof req.query["kind"] === "string" ? req.query["kind"] : null;
    const conditions = [];
    if (status) conditions.push(eq(moderationReportsTable.status, status));
    if (kind) conditions.push(eq(moderationReportsTable.targetKind, kind));
    const where = conditions.length ? and(...conditions) : undefined;
    const [{ total }] = (await (where
      ? db.select({ total: sql<number>`cast(count(*) as int)` }).from(moderationReportsTable).where(where)
      : db.select({ total: sql<number>`cast(count(*) as int)` }).from(moderationReportsTable))) as Array<{ total: number }>;
    const baseQuery = db.select().from(moderationReportsTable);
    const filtered = where ? baseQuery.where(where) : baseQuery;
    const rows = await filtered
      .orderBy(desc(moderationReportsTable.createdAt))
      .limit(perPage)
      .offset(offset);
    respond(res, rows, { pagination: paginate(page, perPage, total) });
  },
);

const ResolveBody = z.object({
  action: z.enum(["approve_keep", "hide", "warn", "ban"]),
  notes: z.string().max(2000).optional(),
});

router.post(
  "/admin/moderation/:id/resolve",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const parsed = ResolveBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const [row] = await db
      .update(moderationReportsTable)
      .set({
        status: "resolved",
        action: parsed.data.action,
        notes: parsed.data.notes ?? null,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(moderationReportsTable.id, id))
      .returning();
    if (!row) {
      respondError(res, 404, "not_found", "Report not found");
      return;
    }
    respond(res, row);
  },
);

export default router;
