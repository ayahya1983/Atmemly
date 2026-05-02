import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, inArray, sql, and, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  notificationsTable,
  bannedWordsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";
import { audit } from "../lib/audit";

const router: IRouter = Router();

// ───────────────── Notification broadcast ─────────────────

const BroadcastBody = z
  .object({
    audience: z.enum(["all", "freelancers", "clients", "user_ids"]),
    userIds: z.array(z.number().int().min(1)).max(5000).optional(),
    kind: z.string().trim().min(1).max(60).default("admin_broadcast"),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    link: z.string().max(500).nullable().optional(),
  })
  .refine((v) => v.audience !== "user_ids" || (v.userIds && v.userIds.length > 0), {
    message: "userIds required when audience=user_ids",
  });

router.post(
  "/admin/notifications/broadcast",
  requireAuth,
  requirePermission("notifications", "write"),
  async (req, res): Promise<void> => {
    const parsed = BroadcastBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    let recipientIds: number[] = [];
    if (f.audience === "user_ids") {
      const wanted = f.userIds!;
      const found = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(inArray(usersTable.id, wanted), eq(usersTable.status, "active")));
      recipientIds = found.map((r) => r.id);
    } else {
      const cond = [eq(usersTable.status, "active")];
      if (f.audience === "freelancers") cond.push(eq(usersTable.role, "freelancer"));
      if (f.audience === "clients") cond.push(eq(usersTable.role, "client"));
      const rows = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(...cond));
      recipientIds = rows.map((r) => r.id);
    }
    if (recipientIds.length === 0) {
      res.json({ count: 0, audience: f.audience });
      return;
    }
    // Bulk-insert in chunks to keep parameter counts sane.
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < recipientIds.length; i += CHUNK) {
      const slice = recipientIds.slice(i, i + CHUNK);
      const rows = slice.map((uid) => ({
        userId: uid,
        kind: f.kind,
        title: f.title,
        body: f.body,
        link: f.link ?? null,
      }));
      const ins = await db.insert(notificationsTable).values(rows).returning({ id: notificationsTable.id });
      inserted += ins.length;
    }
    await audit(req, "notifications.broadcast", "notification", null, {
      audience: f.audience,
      kind: f.kind,
      count: inserted,
    });
    res.json({ count: inserted, audience: f.audience });
  },
);

// ───────────────── Banned words ─────────────────

const BannedWordBody = z.object({
  word: z.string().trim().min(1).max(200),
  locale: z.string().trim().min(1).max(10).default("any"),
  severity: z.enum(["low", "med", "high"]).default("med"),
  isActive: z.boolean().default(true),
});

router.get(
  "/admin/moderation/banned-words",
  requireAuth,
  requirePermission("moderation", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(bannedWordsTable).orderBy(desc(bannedWordsTable.createdAt));
    res.json(rows);
  },
);

router.post(
  "/admin/moderation/banned-words",
  requireAuth,
  requirePermission("moderation", "write"),
  async (req, res): Promise<void> => {
    const parsed = BannedWordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [row] = await db
        .insert(bannedWordsTable)
        .values({
          word: parsed.data.word.toLowerCase(),
          locale: parsed.data.locale,
          severity: parsed.data.severity,
          isActive: parsed.data.isActive,
          createdById: req.user!.id,
        })
        .returning();
      await audit(req, "moderation.banned_word_add", "banned_word", row!.id, { word: row!.word });
      res.status(201).json(row);
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        res.status(409).json({ error: "word+locale already exists" });
        return;
      }
      throw e;
    }
  },
);

router.delete(
  "/admin/moderation/banned-words/:id",
  requireAuth,
  requirePermission("moderation", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(bannedWordsTable).where(eq(bannedWordsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(bannedWordsTable).where(eq(bannedWordsTable.id, id));
    await audit(req, "moderation.banned_word_remove", "banned_word", id, { word: before.word });
    res.json({ id, deleted: true });
  },
);

void sql;
export default router;
