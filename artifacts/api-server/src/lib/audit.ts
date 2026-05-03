import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { clientIp, clientUa } from "./auth";
import { logger } from "./logger";

export async function audit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId: number | null = null,
  metadata: Record<string, unknown> = {},
  oldValue: unknown = null,
  newValue: unknown = null,
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: req?.user?.id ?? null,
      action,
      entityType,
      entityId,
      metadata,
      oldValue,
      newValue,
      ip: req ? clientIp(req) || null : null,
      userAgent: req ? clientUa(req) || null : null,
    });
  } catch (err) {
    // swallow audit errors so they never break the request
    if (req) req.log?.warn?.({ err }, "audit log insert failed");
    else logger.warn({ err }, "audit log insert failed");
  }
}
