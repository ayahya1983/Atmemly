import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, idempotencyKeysTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Architecture audit (May 2026) — generic idempotency middleware.
 *
 * Mounted on a write route, the middleware:
 *   1. Reads the `Idempotency-Key` header (RFC draft format). If absent, it
 *      passes through with no protection — caller opt-in.
 *   2. Looks up (route, key) in idempotency_keys. On hit, the original
 *      response (status + JSON body) is replayed verbatim, EXCEPT when the
 *      stored requestHash differs from the current body hash → 409 because
 *      the client reused a key for different content.
 *   3. On miss, it intercepts res.json and stores (status, body, hash) into
 *      idempotency_keys after the route returns 2xx.
 *
 * Storage failures are logged and SWALLOWED — the route still completes for
 * the caller; idempotency is best-effort and a defense-in-depth layer on top
 * of resource-level UNIQUE constraints (e.g. payment_transactions has its
 * own (gateway, idempotency_key) UNIQUE for race safety).
 *
 * Usage:
 *   router.post("/wallet/payouts", requireAuth, withIdempotency("wallet:payouts"), handler);
 */
export function withIdempotency(routeKey: string) {
  return async function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const headerKey = req.header("idempotency-key");
    if (!headerKey) {
      next();
      return;
    }
    if (!/^[A-Za-z0-9_\-:.]{8,128}$/.test(headerKey)) {
      res.status(400).json({ error: "Invalid Idempotency-Key header" });
      return;
    }

    const bodyJson = JSON.stringify(req.body ?? {});
    const requestHash = createHash("sha256").update(bodyJson).digest("hex");

    try {
      const [existing] = await db
        .select()
        .from(idempotencyKeysTable)
        .where(
          and(
            eq(idempotencyKeysTable.route, routeKey),
            eq(idempotencyKeysTable.key, headerKey),
          ),
        );
      if (existing) {
        if (existing.requestHash !== requestHash) {
          res.status(409).json({
            error: "idempotency_key_conflict",
            message:
              "This Idempotency-Key was used with a different request body.",
          });
          return;
        }
        res.setHeader("X-Idempotent-Replay", "true");
        res.status(existing.responseStatus).json(existing.responseSnapshot);
        return;
      }
    } catch (err) {
      logger.warn({ err, route: routeKey }, "idempotency lookup failed; bypassing");
      next();
      return;
    }

    // Patch res.json to capture the response, then persist the snapshot.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const status = res.statusCode || 200;
      // Only persist successful responses; client errors should be retryable.
      if (status >= 200 && status < 300) {
        db.insert(idempotencyKeysTable)
          .values({
            route: routeKey,
            key: headerKey,
            userId: req.user?.id ?? null,
            requestHash,
            responseStatus: status,
            responseSnapshot: body as never,
          })
          .onConflictDoNothing()
          .catch((err) => {
            logger.warn({ err, route: routeKey }, "idempotency snapshot insert failed");
          });
      }
      return originalJson(body);
    };

    next();
  };
}
