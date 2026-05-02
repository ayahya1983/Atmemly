import { db, notificationsTable, type Notification } from "@workspace/db";
import { emitToUser } from "./realtime";
import { sendPush } from "./push";
import { logger } from "./logger";

export interface NotifyInput {
  userId: number;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
}

export async function notify(input: NotifyInput): Promise<Notification> {
  const [row] = await db
    .insert(notificationsTable)
    .values({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })
    .returning();
  if (!row) throw new Error("Notification insert failed");
  emitToUser(input.userId, "notification:new", row);
  // Phase 4: best-effort push fan-out. Never blocks the request path.
  setImmediate(() => {
    sendPush(input.userId, {
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      data: { kind: input.kind, notificationId: row.id },
    }).catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err, userId: input.userId }, "push dispatch failed");
    });
  });
  return row;
}
