import { Router, type IRouter } from "express";
import { and, eq, desc, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  disputesTable,
  disputeMessagesTable,
  contractsTable,
  milestonesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";
import { notify } from "../lib/notify";
import { emitToUser } from "../lib/realtime";

const router: IRouter = Router();

const CreateDisputeBody = z.object({
  milestoneId: z.number().int().positive().nullable().optional(),
  kind: z.enum(["quality", "payment", "scope", "deadline", "communication", "other"]),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
});

const PostMessageBody = z.object({
  body: z.string().min(1).max(5000),
});

const AdminUpdateDisputeBody = z.object({
  status: z.enum(["open", "under_review", "resolved", "rejected", "closed"]),
  resolutionNotes: z.string().max(5000).optional(),
});

async function disputeDetail(disputeId: number) {
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, disputeId));
  if (!d) return null;
  const [raisedBy] = await db.select().from(usersTable).where(eq(usersTable.id, d.raisedById));
  const [raisedAgainst] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, d.raisedAgainstId));
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, d.contractId));
  return {
    id: d.id,
    contractId: d.contractId,
    milestoneId: d.milestoneId,
    raisedById: d.raisedById,
    raisedByName: raisedBy?.fullName ?? "",
    raisedAgainstId: d.raisedAgainstId,
    raisedAgainstName: raisedAgainst?.fullName ?? "",
    contractTitle: contract?.title ?? "",
    kind: d.kind,
    subject: d.subject,
    description: d.description,
    status: d.status,
    resolutionNotes: d.resolutionNotes,
    resolvedById: d.resolvedById,
    resolvedAt: d.resolvedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

router.post("/contracts/:id/disputes", requireAuth, async (req, res): Promise<void> => {
  const contractId = Number(req.params["id"]);
  if (!Number.isFinite(contractId)) {
    res.status(400).json({ error: "Invalid contract id" });
    return;
  }
  const parsed = CreateDisputeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, contractId));
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  const uid = req.user!.id;
  if (contract.clientId !== uid && contract.freelancerId !== uid) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raisedAgainstId =
    contract.clientId === uid ? contract.freelancerId : contract.clientId;
  if (parsed.data.milestoneId != null) {
    const [m] = await db
      .select()
      .from(milestonesTable)
      .where(eq(milestonesTable.id, parsed.data.milestoneId));
    if (!m || m.contractId !== contractId) {
      res.status(400).json({ error: "Milestone does not belong to contract" });
      return;
    }
  }
  const [d] = await db
    .insert(disputesTable)
    .values({
      contractId,
      milestoneId: parsed.data.milestoneId ?? null,
      raisedById: uid,
      raisedAgainstId,
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      description: parsed.data.description,
      status: "open",
    })
    .returning();
  await audit(req, "dispute.create", "dispute", d!.id, {
    contractId,
    kind: parsed.data.kind,
  });
  await notify({
    userId: raisedAgainstId,
    kind: "dispute",
    title: "A dispute was opened",
    body: parsed.data.subject,
    link: "/dashboard/disputes",
  });
  const detail = await disputeDetail(d!.id);
  res.json(detail);
});

router.get("/disputes", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const rows = await db
    .select({ id: disputesTable.id })
    .from(disputesTable)
    .where(or(eq(disputesTable.raisedById, uid), eq(disputesTable.raisedAgainstId, uid)))
    .orderBy(desc(disputesTable.createdAt))
    .limit(200);
  const out = await Promise.all(rows.map((r) => disputeDetail(r.id)));
  res.json(out.filter(Boolean));
});

router.get("/disputes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!d) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }
  const uid = req.user!.id;
  if (
    req.user!.role !== "admin" &&
    d.raisedById !== uid &&
    d.raisedAgainstId !== uid
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const detail = await disputeDetail(id);
  res.json(detail);
});

router.get("/disputes/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!d) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }
  const uid = req.user!.id;
  if (
    req.user!.role !== "admin" &&
    d.raisedById !== uid &&
    d.raisedAgainstId !== uid
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select({ m: disputeMessagesTable, u: usersTable })
    .from(disputeMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, disputeMessagesTable.senderId))
    .where(eq(disputeMessagesTable.disputeId, id))
    .orderBy(disputeMessagesTable.createdAt);
  res.json(
    rows.map(({ m, u }) => ({
      id: m.id,
      disputeId: m.disputeId,
      senderId: m.senderId,
      senderName: u.fullName,
      senderAvatarUrl: u.avatarUrl,
      body: m.body,
      createdAt: m.createdAt,
    })),
  );
});

router.post("/disputes/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = PostMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!d) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }
  const uid = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && d.raisedById !== uid && d.raisedAgainstId !== uid) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [msg] = await db
    .insert(disputeMessagesTable)
    .values({ disputeId: id, senderId: uid, body: parsed.data.body })
    .returning();
  await db
    .update(disputesTable)
    .set({ updatedAt: new Date() })
    .where(eq(disputesTable.id, id));
  // Notify the other party (or both parties if admin posted)
  const recipients = new Set<number>();
  if (isAdmin) {
    recipients.add(d.raisedById);
    recipients.add(d.raisedAgainstId);
  } else {
    recipients.add(uid === d.raisedById ? d.raisedAgainstId : d.raisedById);
  }
  for (const r of recipients) {
    emitToUser(r, "dispute:message", {
      disputeId: id,
      message: msg,
    });
    await notify({
      userId: r,
      kind: "dispute_message",
      title: "Dispute reply",
      body: parsed.data.body.slice(0, 120),
      link: `/dashboard/disputes/${id}`,
    });
  }
  res.json({
    id: msg!.id,
    disputeId: msg!.disputeId,
    senderId: msg!.senderId,
    senderName: req.user!.fullName,
    senderAvatarUrl: req.user!.avatarUrl,
    body: msg!.body,
    createdAt: msg!.createdAt,
  });
});

// ---------------- Admin ----------------

router.get(
  "/admin/disputes",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const status = typeof req.query["status"] === "string" ? req.query["status"] : null;
    const conds = [];
    if (status) conds.push(eq(disputesTable.status, status));
    const rows = await db
      .select({ id: disputesTable.id })
      .from(disputesTable)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(disputesTable.createdAt))
      .limit(500);
    const out = await Promise.all(rows.map((r) => disputeDetail(r.id)));
    res.json(out.filter(Boolean));
  },
);

router.patch(
  "/admin/disputes/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = AdminUpdateDisputeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const updates: Record<string, unknown> = {
      status: parsed.data.status,
      updatedAt: new Date(),
    };
    if (parsed.data.resolutionNotes !== undefined) {
      updates.resolutionNotes = parsed.data.resolutionNotes;
    }
    if (parsed.data.status === "resolved" || parsed.data.status === "rejected") {
      updates.resolvedById = req.user!.id;
      updates.resolvedAt = new Date();
    }
    const [d] = await db
      .update(disputesTable)
      .set(updates)
      .where(eq(disputesTable.id, id))
      .returning();
    if (!d) {
      res.status(404).json({ error: "Dispute not found" });
      return;
    }
    await audit(req, "dispute.update_status", "dispute", id, {
      status: parsed.data.status,
    });
    for (const uid of [d.raisedById, d.raisedAgainstId]) {
      await notify({
        userId: uid,
        kind: "dispute_status",
        title: `Dispute ${parsed.data.status}`,
        body: d.subject,
        link: `/dashboard/disputes/${id}`,
      });
    }
    const detail = await disputeDetail(id);
    res.json(detail);
  },
);

void sql;
export default router;
