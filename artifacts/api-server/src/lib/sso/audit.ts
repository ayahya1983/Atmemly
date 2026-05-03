import type { Request } from "express";
import { db, loginAuditLogsTable } from "@workspace/db";
import { clientIp, clientUa } from "../auth";
import { logger } from "../logger";

export type SsoOutcome =
  | "success"
  | "failure"
  | "needs_linking"
  | "provisioned"
  | "link"
  | "unlink"
  | "provider_change"
  | "denied";

export async function ssoAudit(args: {
  req: Request | null;
  action: string;
  outcome: SsoOutcome;
  userId?: number | null;
  providerId?: number | null;
  providerSlug?: string | null;
  email?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(loginAuditLogsTable).values({
      userId: args.userId ?? null,
      providerId: args.providerId ?? null,
      providerSlug: args.providerSlug ?? null,
      email: args.email ?? null,
      action: args.action,
      outcome: args.outcome,
      reason: args.reason ?? null,
      ip: args.req ? clientIp(args.req) || null : null,
      userAgent: args.req ? clientUa(args.req) || null : null,
      metadata: args.metadata ?? {},
    });
  } catch (err) {
    if (args.req) args.req.log?.warn?.({ err }, "sso audit insert failed");
    else logger.warn({ err }, "sso audit insert failed");
  }
}
