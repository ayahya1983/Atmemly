import { db, notificationsTable, type Notification } from "@workspace/db";
import { emitToUser } from "./realtime";

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
  return row;
}
