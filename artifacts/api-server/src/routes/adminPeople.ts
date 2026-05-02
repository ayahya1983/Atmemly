import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, sql, and, ilike, or, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  freelancerProfilesTable,
  clientProfilesTable,
  verificationsTable,
  paymentsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";
import { audit } from "../lib/audit";

const router: IRouter = Router();

// ───────────────── Freelancers ─────────────────

const FreelancerListQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  verificationStatus: z
    .enum(["not_submitted", "pending", "approved", "rejected"])
    .optional(),
  status: z.enum(["active", "suspended", "banned", "deleted"]).optional(),
  sort: z.enum(["createdAt", "trustScore"]).default("createdAt"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/freelancers",
  requireAuth,
  requirePermission("freelancers", "read"),
  async (req, res): Promise<void> => {
    const parsed = FreelancerListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [eq(usersTable.role, "freelancer")];
    if (f.status) conds.push(eq(usersTable.status, f.status));
    if (f.verificationStatus) {
      conds.push(eq(freelancerProfilesTable.verificationStatus, f.verificationStatus));
    }
    if (f.q) {
      const like = `%${f.q}%`;
      conds.push(
        or(
          ilike(usersTable.fullName, like),
          ilike(usersTable.email, like),
          ilike(freelancerProfilesTable.headline, like),
        )!,
      );
    }
    const where = and(...conds);
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(usersTable)
      .leftJoin(freelancerProfilesTable, eq(freelancerProfilesTable.userId, usersTable.id))
      .where(where);
    const orderBy =
      f.sort === "trustScore" ? desc(freelancerProfilesTable.trustScore) : desc(usersTable.createdAt);
    const rows = await db
      .select({ u: usersTable, p: freelancerProfilesTable })
      .from(usersTable)
      .leftJoin(freelancerProfilesTable, eq(freelancerProfilesTable.userId, usersTable.id))
      .where(where)
      .orderBy(orderBy)
      .limit(f.limit)
      .offset(f.offset);
    res.json({
      total,
      limit: f.limit,
      offset: f.offset,
      items: rows.map(({ u, p }) => ({
        userId: u.id,
        email: u.email,
        fullName: u.fullName,
        status: u.status,
        headline: p?.headline ?? null,
        skills: p?.skills ?? [],
        verificationStatus: p?.verificationStatus ?? "not_submitted",
        trustScore: p?.trustScore ?? 0,
        hourlyRate: p ? Number(p.hourlyRate) : null,
        currency: p?.currency ?? null,
        createdAt: u.createdAt,
      })),
    });
  },
);

const TrustScoreBody = z
  .object({
    set: z.number().int().min(0).max(100).optional(),
    delta: z.number().int().min(-100).max(100).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.set !== undefined || v.delta !== undefined, {
    message: "either set or delta required",
  });

router.patch(
  "/admin/freelancers/:userId/trust-score",
  requireAuth,
  requirePermission("freelancers", "write"),
  async (req, res): Promise<void> => {
    const userId = Number(req.params["userId"]);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid userId" });
      return;
    }
    const parsed = TrustScoreBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(freelancerProfilesTable)
      .where(eq(freelancerProfilesTable.userId, userId));
    if (!before) {
      res.status(404).json({ error: "freelancer profile not found" });
      return;
    }
    const next =
      parsed.data.set !== undefined
        ? parsed.data.set
        : Math.max(0, Math.min(100, before.trustScore + (parsed.data.delta ?? 0)));
    const [after] = await db
      .update(freelancerProfilesTable)
      .set({ trustScore: next, lastScoreAt: new Date() })
      .where(eq(freelancerProfilesTable.userId, userId))
      .returning();
    await audit(
      req,
      "freelancer.trust_score_adjust",
      "freelancer_profile",
      before.id,
      { reason: parsed.data.reason ?? null, manual: true },
      { trustScore: before.trustScore },
      { trustScore: after?.trustScore },
    );
    res.json({ userId, trustScore: after?.trustScore ?? next });
  },
);

const FreelancerVisibilityBody = z.object({
  hidden: z.boolean(),
});
router.patch(
  "/admin/freelancers/:userId/visibility",
  requireAuth,
  requirePermission("freelancers", "write"),
  async (req, res): Promise<void> => {
    const userId = Number(req.params["userId"]);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid userId" });
      return;
    }
    const parsed = FreelancerVisibilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!before || before.role !== "freelancer") {
      res.status(404).json({ error: "freelancer not found" });
      return;
    }
    const nextStatus = parsed.data.hidden ? "suspended" : "active";
    await db.update(usersTable).set({ status: nextStatus }).where(eq(usersTable.id, userId));
    await audit(
      req,
      parsed.data.hidden ? "freelancer.hide" : "freelancer.show",
      "user",
      userId,
      {},
      { status: before.status },
      { status: nextStatus },
    );
    res.json({ userId, status: nextStatus });
  },
);

// ───────────────── Clients ─────────────────

const ClientListQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  verificationStatus: z
    .enum(["not_submitted", "pending", "approved", "rejected"])
    .optional(),
  status: z.enum(["active", "suspended", "banned", "deleted"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/clients",
  requireAuth,
  requirePermission("clients", "read"),
  async (req, res): Promise<void> => {
    const parsed = ClientListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [eq(usersTable.role, "client")];
    if (f.status) conds.push(eq(usersTable.status, f.status));
    if (f.verificationStatus) {
      conds.push(eq(clientProfilesTable.verificationStatus, f.verificationStatus));
    }
    if (f.q) {
      const like = `%${f.q}%`;
      conds.push(
        or(
          ilike(usersTable.fullName, like),
          ilike(usersTable.email, like),
          ilike(clientProfilesTable.companyName, like),
        )!,
      );
    }
    const where = and(...conds);
    const [{ c: total } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(usersTable)
      .leftJoin(clientProfilesTable, eq(clientProfilesTable.userId, usersTable.id))
      .where(where);
    const rows = await db
      .select({ u: usersTable, p: clientProfilesTable })
      .from(usersTable)
      .leftJoin(clientProfilesTable, eq(clientProfilesTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(usersTable.createdAt))
      .limit(f.limit)
      .offset(f.offset);
    const items = await Promise.all(
      rows.map(async ({ u, p }) => {
        const [spend] = await db
          .select({ s: sql<string>`coalesce(sum(amount),0)::text` })
          .from(paymentsTable)
          .where(and(eq(paymentsTable.payerId, u.id), eq(paymentsTable.status, "succeeded")));
        return {
          userId: u.id,
          email: u.email,
          fullName: u.fullName,
          status: u.status,
          companyName: p?.companyName ?? null,
          verificationStatus: p?.verificationStatus ?? "not_submitted",
          qualityScore: p?.qualityScore ?? 0,
          totalSpend: Number(spend?.s ?? 0),
          createdAt: u.createdAt,
        };
      }),
    );
    res.json({ total, limit: f.limit, offset: f.offset, items });
  },
);

const ClientVerifyBody = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});
router.post(
  "/admin/clients/:userId/verify",
  requireAuth,
  requirePermission("clients", "approve"),
  async (req, res): Promise<void> => {
    const userId = Number(req.params["userId"]);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ error: "invalid userId" });
      return;
    }
    const parsed = ClientVerifyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, userId));
    if (!before) {
      res.status(404).json({ error: "client profile not found" });
      return;
    }
    const [after] = await db
      .update(clientProfilesTable)
      .set({ verificationStatus: parsed.data.decision })
      .where(eq(clientProfilesTable.userId, userId))
      .returning();
    await audit(
      req,
      `client.verify_${parsed.data.decision}`,
      "client_profile",
      before.id,
      { reason: parsed.data.reason ?? null },
      { verificationStatus: before.verificationStatus },
      { verificationStatus: after?.verificationStatus },
    );
    res.json({ userId, verificationStatus: after?.verificationStatus });
  },
);

// ───────────────── Verifications (KYC queue) ─────────────────

const VerificationListQuery = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  kind: z.string().trim().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/admin/verifications",
  requireAuth,
  requirePermission("verifications", "read"),
  async (req, res): Promise<void> => {
    const parsed = VerificationListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const f = parsed.data;
    const conds = [];
    if (f.status) conds.push(eq(verificationsTable.status, f.status));
    if (f.kind) conds.push(eq(verificationsTable.kind, f.kind));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({ v: verificationsTable, u: usersTable })
      .from(verificationsTable)
      .leftJoin(usersTable, eq(usersTable.id, verificationsTable.userId))
      .where(where)
      .orderBy(desc(verificationsTable.submittedAt))
      .limit(f.limit)
      .offset(f.offset);
    res.json(
      rows.map(({ v, u }) => ({
        id: v.id,
        userId: v.userId,
        userName: u?.fullName ?? null,
        userRole: u?.role ?? null,
        kind: v.kind,
        status: v.status,
        documentUrls: v.documentUrls,
        fullLegalName: v.fullLegalName,
        documentNumber: v.documentNumber,
        notes: v.notes,
        rejectionReason: v.rejectionReason,
        submittedAt: v.submittedAt,
        reviewedAt: v.reviewedAt,
      })),
    );
  },
);

const VerifyDecisionBody = z.object({
  reason: z.string().trim().max(500).optional(),
});

router.post(
  "/admin/verifications/:id/:decision",
  requireAuth,
  requirePermission("verifications", "approve"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    const decisionRaw = req.params["decision"];
    if (!Number.isFinite(id) || (decisionRaw !== "approve" && decisionRaw !== "reject")) {
      res.status(400).json({ error: "invalid params" });
      return;
    }
    const decision: "approved" | "rejected" = decisionRaw === "approve" ? "approved" : "rejected";
    const parsed = VerifyDecisionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(verificationsTable)
      .where(eq(verificationsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "verification not found" });
      return;
    }
    if (before.status !== "pending") {
      res.status(409).json({ error: "verification already reviewed" });
      return;
    }
    const [after] = await db
      .update(verificationsTable)
      .set({
        status: decision,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
        rejectionReason: decision === "rejected" ? parsed.data.reason ?? null : null,
      })
      .where(eq(verificationsTable.id, id))
      .returning();
    // Mirror onto the freelancer/client profile so listings reflect the decision.
    if (before.kind === "id_card" || before.kind === "passport" || before.kind === "selfie") {
      await db
        .update(freelancerProfilesTable)
        .set({ verificationStatus: decision })
        .where(eq(freelancerProfilesTable.userId, before.userId));
    } else if (before.kind === "trade_license" || before.kind === "company") {
      await db
        .update(clientProfilesTable)
        .set({ verificationStatus: decision })
        .where(eq(clientProfilesTable.userId, before.userId));
    }
    await audit(
      req,
      `verification.${decision}`,
      "verification",
      id,
      { reason: parsed.data.reason ?? null },
      { status: before.status },
      { status: after?.status },
    );
    res.json({
      id,
      status: after?.status,
      reviewedAt: after?.reviewedAt,
      rejectionReason: after?.rejectionReason,
    });
  },
);

export default router;
