import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, deviceTokensTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";

const router: IRouter = Router();

const RegisterBody = z.object({
  platform: z.enum(["ios", "android", "web", "expo"]),
  token: z.string().min(8).max(4096),
  appVersion: z.string().max(64).optional(),
  locale: z.string().max(16).optional(),
});

router.get("/me/devices", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(deviceTokensTable)
    .where(eq(deviceTokensTable.userId, req.user!.id))
    .orderBy(desc(deviceTokensTable.lastSeenAt));
  respond(res, rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    token: r.token.slice(0, 8) + "…",
    appVersion: r.appVersion,
    locale: r.locale,
    lastSeenAt: r.lastSeenAt,
    createdAt: r.createdAt,
  })));
});

router.post("/me/devices", requireAuth, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    respondError(res, 400, "validation_error", parsed.error.message);
    return;
  }
  const { platform, token, appVersion, locale } = parsed.data;
  const [existing] = await db
    .select()
    .from(deviceTokensTable)
    .where(eq(deviceTokensTable.token, token));
  if (existing) {
    if (existing.userId !== req.user!.id) {
      respondError(res, 409, "token_owned_by_other_user", "Token registered to another account");
      return;
    }
    const [updated] = await db
      .update(deviceTokensTable)
      .set({ lastSeenAt: new Date(), platform, appVersion: appVersion ?? existing.appVersion, locale: locale ?? existing.locale })
      .where(eq(deviceTokensTable.id, existing.id))
      .returning();
    respond(res, { id: updated!.id, platform: updated!.platform, lastSeenAt: updated!.lastSeenAt });
    return;
  }
  const [row] = await db
    .insert(deviceTokensTable)
    .values({ userId: req.user!.id, platform, token, appVersion: appVersion ?? null, locale: locale ?? null })
    .returning();
  respond(res, { id: row!.id, platform: row!.platform, lastSeenAt: row!.lastSeenAt });
});

router.delete("/me/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    respondError(res, 400, "invalid_id", "Invalid device id");
    return;
  }
  const deleted = await db
    .delete(deviceTokensTable)
    .where(and(eq(deviceTokensTable.id, id), eq(deviceTokensTable.userId, req.user!.id)))
    .returning({ id: deviceTokensTable.id });
  if (deleted.length === 0) {
    respondError(res, 404, "not_found", "Device not found");
    return;
  }
  respond(res, { id });
});

export default router;
