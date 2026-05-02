import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, platformSettingsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";

const router: IRouter = Router();

const PutSettingBody = z.object({
  value: z.unknown(),
  isPublic: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

router.get("/settings/public", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.isPublic, 1));
  res.json(
    Object.fromEntries(rows.map((r) => [r.key, r.value])),
  );
});

router.get(
  "/admin/settings",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(platformSettingsTable);
    res.json(
      rows.map((r) => ({
        key: r.key,
        value: r.value,
        isPublic: r.isPublic === 1,
        description: r.description,
        updatedAt: r.updatedAt,
        updatedById: r.updatedById,
      })),
    );
  },
);

router.put(
  "/admin/settings/:key",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const key = req.params["key"] ?? "";
    if (!/^[a-z0-9_.]{2,64}$/.test(key)) {
      res.status(400).json({ error: "Invalid key" });
      return;
    }
    const parsed = PutSettingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const setBlock: Record<string, unknown> = {
      value: parsed.data.value,
      updatedAt: new Date(),
      updatedById: req.user!.id,
    };
    if (parsed.data.isPublic !== undefined) {
      setBlock.isPublic = parsed.data.isPublic ? 1 : 0;
    }
    if (parsed.data.description !== undefined) {
      setBlock.description = parsed.data.description;
    }
    const insertBlock: typeof platformSettingsTable.$inferInsert = {
      key,
      value: parsed.data.value,
      isPublic: parsed.data.isPublic ? 1 : 0,
      description: parsed.data.description ?? null,
      updatedById: req.user!.id,
    };
    const [row] = await db
      .insert(platformSettingsTable)
      .values(insertBlock)
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: setBlock,
      })
      .returning();
    await audit(req, "setting.update", "platform_setting", null, {
      key,
    });
    res.json({
      key: row!.key,
      value: row!.value,
      isPublic: row!.isPublic === 1,
      description: row!.description,
      updatedAt: row!.updatedAt,
      updatedById: row!.updatedById,
    });
  },
);

export default router;
