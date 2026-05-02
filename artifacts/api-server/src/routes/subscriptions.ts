import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  subscriptionPlansTable,
  userSubscriptionsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";

const router: IRouter = Router();

const PlanBody = z.object({
  slug: z.string().min(2).max(64),
  nameEn: z.string().min(1).max(120),
  nameAr: z.string().min(1).max(120),
  descriptionEn: z.string().max(2000).optional(),
  descriptionAr: z.string().max(2000).optional(),
  audience: z.enum(["freelancer", "client"]),
  period: z.enum(["monthly", "yearly"]),
  priceAed: z.number().nonnegative(),
  features: z.array(z.string().max(200)).max(40).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

router.get("/subscription-plans", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.isActive, true))
    .orderBy(subscriptionPlansTable.sortOrder, subscriptionPlansTable.id);
  respond(res, rows);
});

router.get(
  "/admin/subscription-plans",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(subscriptionPlansTable.sortOrder, subscriptionPlansTable.id);
    respond(res, rows);
  },
);

router.post(
  "/admin/subscription-plans",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = PlanBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    try {
      const [row] = await db
        .insert(subscriptionPlansTable)
        .values({
          ...parsed.data,
          priceAed: String(parsed.data.priceAed),
          descriptionEn: parsed.data.descriptionEn ?? null,
          descriptionAr: parsed.data.descriptionAr ?? null,
        })
        .returning();
      respond(res, row);
    } catch (err) {
      const message = err instanceof Error ? err.message : "insert failed";
      if (/unique|duplicate/i.test(message)) {
        respondError(res, 409, "slug_taken", "Plan slug already exists");
        return;
      }
      throw err;
    }
  },
);

router.put(
  "/admin/subscription-plans/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const parsed = PlanBody.partial().safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.priceAed != null) updateData["priceAed"] = String(parsed.data.priceAed);
    const [row] = await db
      .update(subscriptionPlansTable)
      .set(updateData)
      .where(eq(subscriptionPlansTable.id, id))
      .returning();
    if (!row) {
      respondError(res, 404, "not_found", "Plan not found");
      return;
    }
    respond(res, row);
  },
);

router.get("/me/subscription", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(and(eq(userSubscriptionsTable.userId, req.user!.id), eq(userSubscriptionsTable.status, "active")))
    .orderBy(desc(userSubscriptionsTable.startedAt))
    .limit(1);
  if (!sub) {
    respond(res, null);
    return;
  }
  const [plan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, sub.planId));
  respond(res, { ...sub, plan: plan ?? null });
});

const SubscribeBody = z.object({
  planId: z.number().int().positive(),
  autoRenew: z.boolean().optional(),
});

router.post("/me/subscription", requireAuth, async (req, res): Promise<void> => {
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    respondError(res, 400, "validation_error", parsed.error.message);
    return;
  }
  const [plan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, parsed.data.planId));
  if (!plan || !plan.isActive) {
    respondError(res, 404, "plan_not_available", "Plan not available");
    return;
  }
  // Cancel any active subscription first
  await db
    .update(userSubscriptionsTable)
    .set({ status: "superseded", canceledAt: new Date() })
    .where(and(eq(userSubscriptionsTable.userId, req.user!.id), eq(userSubscriptionsTable.status, "active")));
  const months = plan.period === "yearly" ? 12 : 1;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);
  const [row] = await db
    .insert(userSubscriptionsTable)
    .values({
      userId: req.user!.id,
      planId: plan.id,
      status: "active",
      expiresAt,
      autoRenew: parsed.data.autoRenew ?? false,
    })
    .returning();
  respond(res, { subscription: row, plan });
});

router.post("/me/subscription/cancel", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db
    .update(userSubscriptionsTable)
    .set({ status: "canceled", canceledAt: new Date(), autoRenew: false })
    .where(and(eq(userSubscriptionsTable.userId, req.user!.id), eq(userSubscriptionsTable.status, "active")))
    .returning();
  if (!sub) {
    respondError(res, 404, "no_active_subscription", "No active subscription");
    return;
  }
  respond(res, sub);
});

export default router;
