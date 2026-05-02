import { Router, type IRouter } from "express";
import { and, eq, or, desc, sql } from "drizzle-orm";
import {
  db,
  conversationsTable,
  messagesTable,
  jobsTable,
  usersTable,
  notificationsTable,
} from "@workspace/db";
import {
  ListConversationsResponse,
  CreateConversationBody,
  CreateConversationResponse,
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

async function buildConversationSummary(convoId: number, currentUserId: number) {
  const [row] = await db
    .select({ c: conversationsTable, j: jobsTable })
    .from(conversationsTable)
    .innerJoin(jobsTable, eq(jobsTable.id, conversationsTable.jobId))
    .where(eq(conversationsTable.id, convoId));
  if (!row) return null;
  const otherId = row.c.clientId === currentUserId ? row.c.freelancerId : row.c.clientId;
  const [other] = await db.select().from(usersTable).where(eq(usersTable.id, otherId));
  if (!other) return null;
  const [last] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convoId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);
  const [unread] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.conversationId, convoId),
        eq(messagesTable.read, false),
        sql`${messagesTable.senderId} <> ${currentUserId}`,
      ),
    );
  return {
    id: row.c.id,
    otherUserId: other.id,
    otherUserName: other.fullName,
    otherUserAvatarUrl: other.avatarUrl,
    jobId: row.j.id,
    jobTitle: row.j.title,
    lastMessage: last?.body ?? "",
    lastMessageAt: last?.createdAt ?? row.c.lastMessageAt,
    unreadCount: unread?.c ?? 0,
  };
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.id;
  const rows = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(or(eq(conversationsTable.clientId, uid), eq(conversationsTable.freelancerId, uid)))
    .orderBy(desc(conversationsTable.lastMessageAt));
  const convos = await Promise.all(rows.map((r) => buildConversationSummary(r.id, uid)));
  res.json(ListConversationsResponse.parse(convos.filter(Boolean)));
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { jobId, otherUserId } = parsed.data;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const me = req.user!;
  let clientId: number;
  let freelancerId: number;
  if (me.role === "client") {
    clientId = me.id;
    freelancerId = otherUserId;
  } else {
    freelancerId = me.id;
    clientId = otherUserId;
  }
  if (job.clientId !== clientId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.jobId, jobId),
        eq(conversationsTable.clientId, clientId),
        eq(conversationsTable.freelancerId, freelancerId),
      ),
    );
  let convoId: number;
  if (existing) {
    convoId = existing.id;
  } else {
    const [c] = await db
      .insert(conversationsTable)
      .values({ jobId, clientId, freelancerId })
      .returning();
    convoId = c!.id;
  }
  const summary = await buildConversationSummary(convoId, me.id);
  res.json(CreateConversationResponse.parse(summary));
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const uid = req.user!.id;
  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (convo.clientId !== uid && convo.freelancerId !== uid && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select({ m: messagesTable, u: usersTable })
    .from(messagesTable)
    .innerJoin(usersTable, eq(usersTable.id, messagesTable.senderId))
    .where(eq(messagesTable.conversationId, params.data.id))
    .orderBy(messagesTable.createdAt);
  await db
    .update(messagesTable)
    .set({ read: true })
    .where(
      and(
        eq(messagesTable.conversationId, params.data.id),
        sql`${messagesTable.senderId} <> ${uid}`,
      ),
    );
  res.json(
    ListMessagesResponse.parse(
      rows.map((r) => ({
        id: r.m.id,
        conversationId: r.m.conversationId,
        senderId: r.m.senderId,
        senderName: r.u.fullName,
        senderAvatarUrl: r.u.avatarUrl,
        body: r.m.body,
        createdAt: r.m.createdAt,
      })),
    ),
  );
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const uid = req.user!.id;
  const [convo] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.id));
  if (!convo) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (convo.clientId !== uid && convo.freelancerId !== uid) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: params.data.id,
      senderId: uid,
      body: parsed.data.body,
    })
    .returning();
  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, params.data.id));
  const otherId = convo.clientId === uid ? convo.freelancerId : convo.clientId;
  await db.insert(notificationsTable).values({
    userId: otherId,
    kind: "message",
    title: "New message",
    body: parsed.data.body.slice(0, 120),
    link: req.user!.role === "client" ? "/dashboard/freelancer/messages" : "/dashboard/client/messages",
  });
  res.json(
    SendMessageResponse.parse({
      id: message!.id,
      conversationId: message!.conversationId,
      senderId: message!.senderId,
      senderName: req.user!.fullName,
      senderAvatarUrl: req.user!.avatarUrl,
      body: message!.body,
      createdAt: message!.createdAt,
    }),
  );
});

export default router;
