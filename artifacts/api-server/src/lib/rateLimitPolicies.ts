import type { IRouter } from "express";
import { rateLimit } from "./rateLimit";

/**
 * ATMEMLY architecture audit (May 2026) — bound retry storms on payment
 * gateway webhook callbacks. Each gateway already dedupes on
 * (gateway, eventId) UNIQUE, but a runaway gateway shouldn't be able to
 * flood the API. 600/min per IP is well above any normal gateway retry rate.
 *
 * 429 responses include a `Retry-After` header (set by `rateLimit`).
 */
export const WEBHOOK_PATHS: string[] = [
  "/payments/stripe/webhook",
  "/payments/paytabs/callback",
  "/payments/telr/callback",
  "/payments/mock/webhook",
  "/payments/webhook/:gateway",
];

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyPrefix: "webhook",
  message: "Webhook rate limit exceeded — backing off.",
});

/**
 * ATMEMLY architecture audit (May 2026) — bound damage from a compromised
 * or misbehaving admin session. Read traffic (GET/HEAD/OPTIONS) is not
 * limited so dashboards stay snappy; only state-changing verbs are
 * throttled. 120/min/IP is far above any real admin's click-rate.
 */
export const adminMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: "admin-mut",
  message: "Admin mutation rate limit exceeded — slow down.",
});

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Mounts the webhook + admin-mutation rate limiters onto the given router.
 * Must be called before route handlers are mounted so the limiters are in
 * the request pipeline.
 */
export function mountRateLimitPolicies(router: IRouter): void {
  router.use(WEBHOOK_PATHS, webhookLimiter);
  router.use("/admin", (req, res, next) => {
    if (READ_METHODS.has(req.method)) {
      next();
      return;
    }
    adminMutationLimiter(req, res, next);
  });
}
