import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, sql, and, ilike, or, gte, lte, desc, isNotNull, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  jobsTable,
  proposalsTable,
  contractsTable,
  paymentsTable,
  refreshTokensTable,
  adminNotesTable,
} from "@workspace/db";
import { randomBytes } from "node:crypto";
import { requireAuth, hashPassword } from "../lib/auth";
import { requirePermission, hasPermission } from "../lib/permissions";
import { audit } from "../lib/audit";

const router: IRouter = Router();

const SUBJECT_KIND = "user";

const SearchQuery = z.object({
  role: z.enum(["client", "freelancer", "admin"]).optional(),
  status: z.enum(["active", "suspended", "banned", "deleted", "pending_email_verification"]).optional(),
  verified: z.enum(["true", "false"]).optional(),
  q: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/users/search",
  requireAuth,
  requirePermission("users", "read"),
  async (req, res): Promise<void> => {
    const parsed = SearchQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [];
    if (f.role) conds.push(eq(usersTable.role, f.role));
    if (f.status) conds.push(eq(usersTable.status, f.status));
    if (f.verified === "true") conds.push(isNotNull(usersTable.emailVerifiedAt));
    if (f.verified === "false") conds.push(isNull(usersTable.emailVerifiedAt));
    if (f.dateFrom) conds.push(gte(usersTable.createdAt, new Date(f.dateFrom)));
    if (f.dateTo) conds.push(lte(usersTable.createdAt, new Date(f.dateTo)));
    if (f.q) {
      const like = `%${f.q}%`;
      conds.push(
        or(
          ilike(usersTable.email, like),
          ilike(usersTable.fullName, like),
          ilike(usersTable.phone, like),
        )!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(where);
    const rows = await db
      .select()
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    res.json({
      total,
      limit: f.limit,
      offset: f.offset,
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        adminRole: u.adminRole,
        status: u.status,
        phone: u.phone,
        country: u.country,
        emailVerifiedAt: u.emailVerifiedAt,
        createdAt: u.createdAt,
      })),
    });
  },
);

router.get(
  "/admin/users/:id",
  requireAuth,
  requirePermission("users", "read"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!u) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [jobs] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(eq(jobsTable.clientId, id));
    const [props] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(proposalsTable)
      .where(eq(proposalsTable.freelancerId, id));
    const [contractsAsClient] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contractsTable)
      .where(eq(contractsTable.clientId, id));
    const [contractsAsFreelancer] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(contractsTable)
      .where(eq(contractsTable.freelancerId, id));
    const [paid] = await db
      .select({ s: sql<string>`coalesce(sum(amount),0)::text` })
      .from(paymentsTable)
      .where(and(eq(paymentsTable.payerId, id), eq(paymentsTable.status, "succeeded")));
    const recentPayments = await db
      .select()
      .from(paymentsTable)
      .where(or(eq(paymentsTable.payerId, id), eq(paymentsTable.payeeId, id))!)
      .orderBy(desc(paymentsTable.createdAt))
      .limit(10);
    res.json({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      adminRole: u.adminRole,
      status: u.status,
      phone: u.phone,
      country: u.country,
      city: u.city,
      avatarUrl: u.avatarUrl,
      emailVerifiedAt: u.emailVerifiedAt,
      lastLoginAt: u.lastLoginAt,
      lastLoginIp: u.lastLoginIp,
      lastLoginUa: u.lastLoginUa,
      createdAt: u.createdAt,
      counts: {
        jobsPosted: jobs?.c ?? 0,
        proposals: props?.c ?? 0,
        contractsAsClient: contractsAsClient?.c ?? 0,
        contractsAsFreelancer: contractsAsFreelancer?.c ?? 0,
        totalPaid: Number(paid?.s ?? 0),
      },
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  },
);

const PatchBody = z.object({
  status: z
    .enum(["active", "suspended", "banned", "deleted", "pending_email_verification"])
    .optional(),
  role: z.enum(["client", "freelancer", "admin"]).optional(),
  adminRole: z
    .enum(["super_admin", "admin", "moderator", "finance_admin", "content_manager", "support_agent"])
    .nullable()
    .optional(),
  emailVerified: z.boolean().optional(),
});

router.patch(
  "/admin/users/:id",
  requireAuth,
  requirePermission("users", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    // Self-protect: disallow demoting yourself out of admin, banning yourself,
    // or changing your own staff sub-role (no self-elevation to super_admin).
    if (id === req.user!.id) {
      if (parsed.data.role && parsed.data.role !== before.role) {
        res.status(400).json({ error: "cannot change own role" });
        return;
      }
      if (parsed.data.adminRole !== undefined && parsed.data.adminRole !== before.adminRole) {
        res.status(400).json({ error: "cannot change own admin role" });
        return;
      }
      if (parsed.data.status && ["banned", "suspended", "deleted"].includes(parsed.data.status)) {
        res.status(400).json({ error: "cannot change own status to banned/suspended/deleted" });
        return;
      }
    }
    // Privilege-escalation guard: only callers with admin_users:write may
    // change the public `role` or the staff `adminRole` on any user, and only
    // a super_admin may grant `adminRole='super_admin'`.
    const wantsRoleChange =
      (parsed.data.role !== undefined && parsed.data.role !== before.role) ||
      (parsed.data.adminRole !== undefined && parsed.data.adminRole !== before.adminRole);
    if (wantsRoleChange && !hasPermission(req.user!, "admin_users", "write")) {
      res.status(403).json({ error: "forbidden", resource: "admin_users", action: "write" });
      return;
    }
    if (parsed.data.adminRole === "super_admin" && req.user!.adminRole !== "super_admin") {
      res.status(403).json({ error: "only super_admin may grant super_admin" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.status) patch["status"] = parsed.data.status;
    if (parsed.data.role) patch["role"] = parsed.data.role;
    if (parsed.data.adminRole !== undefined) patch["adminRole"] = parsed.data.adminRole;
    if (parsed.data.emailVerified !== undefined) {
      patch["emailVerifiedAt"] = parsed.data.emailVerified ? new Date() : null;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "nothing to update" });
      return;
    }
    const [after] = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, id))
      .returning();
    if (!after) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (parsed.data.status && ["banned", "suspended", "deleted"].includes(parsed.data.status)) {
      await db
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokensTable.userId, id));
    }
    await audit(
      req,
      "user.update",
      "user",
      id,
      { fields: Object.keys(patch) },
      {
        status: before.status,
        role: before.role,
        adminRole: before.adminRole,
        emailVerifiedAt: before.emailVerifiedAt,
      },
      {
        status: after.status,
        role: after.role,
        adminRole: after.adminRole,
        emailVerifiedAt: after.emailVerifiedAt,
      },
    );
    res.json({
      id: after.id,
      email: after.email,
      fullName: after.fullName,
      role: after.role,
      adminRole: after.adminRole,
      status: after.status,
      emailVerifiedAt: after.emailVerifiedAt,
    });
  },
);

router.delete(
  "/admin/users/:id",
  requireAuth,
  requirePermission("users", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ error: "cannot delete self" });
      return;
    }
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (before.status === "deleted") {
      res.status(409).json({ error: "already deleted" });
      return;
    }
    await db.update(usersTable).set({ status: "deleted" }).where(eq(usersTable.id, id));
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.userId, id));
    await audit(
      req,
      "user.soft_delete",
      "user",
      id,
      {},
      { status: before.status },
      { status: "deleted" },
    );
    res.json({ id, status: "deleted" });
  },
);

router.post(
  "/admin/users/:id/reset-password",
  requireAuth,
  requirePermission("users", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const tempPassword = randomBytes(12).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, id));
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.userId, id));
    await audit(req, "user.reset_password", "user", id, { revokedSessions: true });
    res.json({
      id,
      email: target.email,
      tempPassword,
      message: "Temporary password generated; share securely with user.",
    });
  },
);

const NoteBody = z.object({ body: z.string().trim().min(1).max(4000) });

router.get(
  "/admin/users/:id/notes",
  requireAuth,
  requirePermission("users", "read"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const rows = await db
      .select({ n: adminNotesTable, u: usersTable })
      .from(adminNotesTable)
      .leftJoin(usersTable, eq(usersTable.id, adminNotesTable.authorId))
      .where(and(eq(adminNotesTable.subjectKind, SUBJECT_KIND), eq(adminNotesTable.subjectId, id)))
      .orderBy(desc(adminNotesTable.createdAt))
      .limit(200);
    res.json(
      rows.map(({ n, u }) => ({
        id: n.id,
        body: n.body,
        authorId: n.authorId,
        authorName: u?.fullName ?? null,
        createdAt: n.createdAt,
      })),
    );
  },
);

router.post(
  "/admin/users/:id/notes",
  requireAuth,
  requirePermission("users", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = NoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [n] = await db
      .insert(adminNotesTable)
      .values({
        subjectKind: SUBJECT_KIND,
        subjectId: id,
        authorId: req.user!.id,
        body: parsed.data.body,
      })
      .returning();
    await audit(req, "user.note_added", "user", id, { noteId: n!.id });
    res.status(201).json({
      id: n!.id,
      body: n!.body,
      authorId: n!.authorId,
      authorName: req.user!.fullName,
      createdAt: n!.createdAt,
    });
  },
);

export default router;
