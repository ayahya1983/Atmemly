import { db, deviceTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  link?: string | null;
}

export interface PushResult {
  delivered: number;
  attempted: number;
  platforms: Record<string, number>;
}

/**
 * Phase 4 placeholder for push notifications.
 *
 * Looks up active device tokens for the user and *would* dispatch via
 * FCM / APNs / Expo push. For now it logs and returns counts so the
 * integration surface is ready when credentials are configured.
 */
export async function sendPush(userId: number, payload: PushPayload): Promise<PushResult> {
  const tokens = await db
    .select({ id: deviceTokensTable.id, platform: deviceTokensTable.platform, token: deviceTokensTable.token })
    .from(deviceTokensTable)
    .where(eq(deviceTokensTable.userId, userId));
  const platforms: Record<string, number> = {};
  for (const t of tokens) platforms[t.platform] = (platforms[t.platform] ?? 0) + 1;
  if (tokens.length > 0) {
    logger.info(
      { userId, platforms, title: payload.title },
      "push notification (stub) — no provider configured",
    );
  }
  return { delivered: 0, attempted: tokens.length, platforms };
}
