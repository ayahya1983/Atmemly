import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  usersTable,
  verificationsTable,
  freelancerProfilesTable,
  clientProfilesTable,
  notificationsTable,
} from "@workspace/db";
import {
  SubmitVerificationBody,
  SubmitVerificationResponse,
  GetMyVerificationResponse,
  AdminListVerificationsQueryParams,
  AdminListVerificationsResponse,
  AdminReviewVerificationParams,
  AdminReviewVerificationBody,
  AdminReviewVerificationResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";

const router: IRouter = Router();

async function loadVerificationDetail(id: number) {
  const [row] = await db
    .select({ v: verificationsTable, u: usersTable })
    .from(verificationsTable)
    .innerJoin(usersTable, eq(usersTable.id, verificationsTable.userId))
    .where(eq(verificationsTable.id, id));
  if (!row) return null;
  return {
    id: row.v.id,
    userId: row.v.userId,
    userName: row.u.fullName,
    userEmail: row.u.email,
    userRole: row.u.role,
    kind: row.v.kind,
    documentUrls: row.v.documentUrls,
    fullLegalName: row.v.fullLegalName,
    documentNumber: row.v.documentNumber,
    notes: row.v.notes,
    status: row.v.status,
    rejectionReason: row.v.rejectionReason,
    submittedAt: row.v.submittedAt,
    reviewedAt: row.v.reviewedAt,
    reviewedBy: row.v.reviewedBy,
  };
}

async function setProfileVerificationStatus(userId: number, role: string, status: string) {
  if (role === "freelancer") {
    await db
      .update(freelancerProfilesTable)
      .set({ verificationStatus: status })
      .where(eq(freelancerProfilesTable.userId, userId));
  } else if (role === "client") {
    await db
      .update(clientProfilesTable)
      .set({ verificationStatus: status })
      .where(eq(clientProfilesTable.userId, userId));
  }
}

router.get("/verifications", requireAuth, async (req, res): Promise<void> => {
  const [latest] = await db
    .select()
    .from(verificationsTable)
    .where(eq(verificationsTable.userId, req.user!.id))
    .orderBy(desc(verificationsTable.submittedAt))
    .limit(1);
  if (!latest) {
    res.json(
      GetMyVerificationResponse.parse({
        id: 0,
        userId: req.user!.id,
        userName: req.user!.fullName,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        kind: "identity",
        documentUrls: [],
        fullLegalName: null,
        documentNumber: null,
        notes: null,
        status: "not_submitted",
        rejectionReason: null,
        submittedAt: req.user!.createdAt,
        reviewedAt: null,
        reviewedBy: null,
      }),
    );
    return;
  }
  const detail = await loadVerificationDetail(latest.id);
  res.json(GetMyVerificationResponse.parse(detail!));
});

router.post(
  "/verifications",
  requireAuth,
  requireRole("client", "freelancer"),
  async (req, res): Promise<void> => {
    const parsed = SubmitVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.documentUrls.length === 0) {
      res.status(400).json({ error: "At least one document is required" });
      return;
    }
    const [created] = await db
      .insert(verificationsTable)
      .values({
        userId: req.user!.id,
        kind: parsed.data.kind,
        documentUrls: parsed.data.documentUrls,
        fullLegalName: parsed.data.fullLegalName ?? null,
        documentNumber: parsed.data.documentNumber ?? null,
        notes: parsed.data.notes ?? null,
        status: "pending",
      })
      .returning();
    await setProfileVerificationStatus(req.user!.id, req.user!.role, "pending");
    await audit(req, "verification.submit", "verification", created!.id, {
      kind: parsed.data.kind,
    });
    const detail = await loadVerificationDetail(created!.id);
    res.json(SubmitVerificationResponse.parse(detail!));
  },
);

router.get(
  "/admin/verifications",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = AdminListVerificationsQueryParams.safeParse(req.query);
    const conditions = [];
    if (parsed.success && parsed.data.status) {
      conditions.push(eq(verificationsTable.status, parsed.data.status));
    }
    const ids = await db
      .select({ id: verificationsTable.id })
      .from(verificationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(verificationsTable.submittedAt))
      .limit(200);
    const rows = await Promise.all(ids.map((r) => loadVerificationDetail(r.id)));
    res.json(AdminListVerificationsResponse.parse(rows.filter(Boolean)));
  },
);

router.patch(
  "/admin/verifications/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = AdminReviewVerificationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AdminReviewVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select({ v: verificationsTable, u: usersTable })
      .from(verificationsTable)
      .innerJoin(usersTable, eq(usersTable.id, verificationsTable.userId))
      .where(eq(verificationsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Verification not found" });
      return;
    }
    const decision = parsed.data.decision;
    const newStatus = decision === "approve" ? "verified" : "rejected";
    await db
      .update(verificationsTable)
      .set({
        status: newStatus,
        rejectionReason: decision === "reject" ? parsed.data.reason ?? null : null,
        reviewedAt: new Date(),
        reviewedBy: req.user!.id,
      })
      .where(eq(verificationsTable.id, params.data.id));
    await setProfileVerificationStatus(existing.u.id, existing.u.role, newStatus);
    await db.insert(notificationsTable).values({
      userId: existing.u.id,
      kind: "verification",
      title: decision === "approve" ? "Verification approved" : "Verification rejected",
      body:
        decision === "approve"
          ? "Your account has been verified."
          : `Your verification was rejected${parsed.data.reason ? `: ${parsed.data.reason}` : "."}`,
      link: "/dashboard",
    });
    await audit(req, `verification.${decision}`, "verification", params.data.id, {
      reason: parsed.data.reason ?? null,
      targetUserId: existing.u.id,
    });
    const detail = await loadVerificationDetail(params.data.id);
    res.json(AdminReviewVerificationResponse.parse(detail!));
  },
);

export default router;
