import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, platformSettingsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";
import { getActiveGatewayName, getGatewayByName, listGateways } from "../lib/payments";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/payments/gateway", async (_req, res): Promise<void> => {
  const name = await getActiveGatewayName();
  respond(res, {
    active: name,
    available: listGateways(),
  });
});

const SetGatewayBody = z.object({ name: z.enum(["mock", "stripe", "paytabs", "telr"]) });

router.post(
  "/admin/payments/gateway",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = SetGatewayBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const target = getGatewayByName(parsed.data.name);
    if (!target) {
      respondError(res, 400, "unknown_gateway", "Unknown gateway");
      return;
    }
    await db
      .insert(platformSettingsTable)
      .values({
        key: "payment_gateway",
        value: parsed.data.name,
        isPublic: 0,
        description: "Active payment gateway adapter",
        updatedById: req.user!.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettingsTable.key,
        set: { value: parsed.data.name, updatedAt: new Date(), updatedById: req.user!.id },
      });
    respond(res, { active: parsed.data.name, configured: target.configured });
  },
);

router.post("/payments/webhook/:gateway", async (req, res): Promise<void> => {
  const name = String(req.params["gateway"]);
  const gw = getGatewayByName(name);
  if (!gw) {
    respondError(res, 404, "unknown_gateway", "Unknown gateway");
    return;
  }
  const sig = String(req.header("x-webhook-signature") ?? "");
  try {
    const event = await gw.webhookVerify(JSON.stringify(req.body ?? {}), sig);
    logger.info({ gateway: name, eventId: event.id, type: event.type }, "payment webhook received");
    respond(res, { received: true, eventId: event.id, type: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (/not configured/i.test(message)) {
      respondError(res, 503, "gateway_not_configured", message);
      return;
    }
    respondError(res, 400, "webhook_invalid", message);
  }
});

const RefundBody = z.object({
  paymentId: z.number().int().positive().optional(),
  intentId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
}).refine((v) => v.paymentId || v.intentId, { message: "paymentId or intentId required" });

router.post(
  "/admin/payments/refund",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = RefundBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    let intentId = parsed.data.intentId ?? "";
    if (!intentId && parsed.data.paymentId) {
      const { paymentsTable } = await import("@workspace/db");
      const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, parsed.data.paymentId));
      if (!p) {
        respondError(res, 404, "payment_not_found", "Payment not found");
        return;
      }
      intentId = p.stripeIntentId ?? `internal_${p.id}`;
    }
    const gw = getGatewayByName(await getActiveGatewayName());
    if (!gw) {
      respondError(res, 503, "no_gateway", "No active gateway");
      return;
    }
    try {
      const result = await gw.refund(intentId, parsed.data.amount);
      respond(res, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      respondError(res, 503, "refund_failed", message);
    }
  },
);

export default router;
