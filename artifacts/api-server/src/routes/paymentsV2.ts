import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  db,
  paymentTransactionsTable,
  paymentIntentsTable,
  paymentWebhooksTable,
  paymentGatewaysTable,
  contractsTable,
  milestonesTable,
  attachmentsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { respond, respondError, parsePagination, paginate } from "../lib/apiResponse";
import {
  getActiveGatewayName,
  getGatewayByName,
  listGateways,
  getManualBankDetails,
  type GatewayName,
} from "../lib/payments";
import { markTransactionPaidAndFundEscrow } from "../lib/payments/processing";
import { audit } from "../lib/audit";
import { notify } from "../lib/notify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const GATEWAY_NAMES: [GatewayName, ...GatewayName[]] = ["mock", "stripe", "paytabs", "telr", "manual"];

// ----------------------------------------------------------------------------
// GET /payments/gateways — public list of gateways with active flag and config.
// (Phase 4's /payments/gateway is preserved for backward compat.)
// ----------------------------------------------------------------------------
router.get("/payments/gateways", async (_req, res): Promise<void> => {
  const active = await getActiveGatewayName();
  const codeRows = await db.select().from(paymentGatewaysTable);
  const byCode = new Map(codeRows.map((r) => [r.providerCode, r]));
  const out = listGateways().map((g) => {
    const row = byCode.get(g.name);
    return {
      name: g.name,
      label: g.label,
      configured: g.configured,
      isActive: row?.isActive ?? g.name === active,
      mode: row?.mode ?? "TEST",
      supportedCurrencies:
        row?.supportedCurrencies && row.supportedCurrencies.length > 0
          ? row.supportedCurrencies
          : g.supportedCurrencies,
      isDefault: g.name === active,
    };
  });
  respond(res, out, { active });
});

// ----------------------------------------------------------------------------
// POST /payments/intents — create a new payment transaction + gateway intent.
// ----------------------------------------------------------------------------
const CreateIntentBody = z
  .object({
    gateway: z.enum(GATEWAY_NAMES).optional(),
    paymentPurpose: z
      .enum(["contract_funding", "milestone_funding", "subscription", "featured_listing", "other"])
      .default("milestone_funding"),
    contractId: z.number().int().positive().optional(),
    milestoneId: z.number().int().positive().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).default("AED"),
    idempotencyKey: z.string().min(8).max(120).optional(),
    description: z.string().max(500).optional(),
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    metadata: z.record(z.string()).optional(),
  })
  .refine((v) => v.paymentPurpose !== "milestone_funding" || !!v.milestoneId, {
    message: "milestoneId required for milestone_funding",
  });

router.post("/payments/intents", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateIntentBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    respondError(res, 400, "validation_error", parsed.error.message);
    return;
  }
  const userId = req.user!.id;

  const gatewayName: GatewayName = parsed.data.gateway ?? (await getActiveGatewayName());
  const gw = getGatewayByName(gatewayName);
  if (!gw) {
    respondError(res, 400, "unknown_gateway", `Unknown gateway: ${gatewayName}`);
    return;
  }
  if (!gw.configured) {
    respondError(
      res,
      503,
      "gateway_not_configured",
      `Gateway "${gatewayName}" is not configured on this server.`,
    );
    return;
  }

  // Resolve amount/currency from milestone if anchored, otherwise from body.
  let resolvedAmount: number | null = parsed.data.amount ?? null;
  let resolvedCurrency = parsed.data.currency.toUpperCase();
  let contractId: number | null = parsed.data.contractId ?? null;
  let milestoneId: number | null = parsed.data.milestoneId ?? null;

  if (parsed.data.paymentPurpose === "milestone_funding" && milestoneId) {
    const [m] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestoneId));
    if (!m) {
      respondError(res, 404, "milestone_not_found", "Milestone not found");
      return;
    }
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, m.contractId));
    if (!contract) {
      respondError(res, 404, "contract_not_found", "Parent contract missing");
      return;
    }
    if (contract.clientId !== userId && req.user!.role !== "admin") {
      respondError(res, 403, "forbidden", "Only the contract client can fund milestones");
      return;
    }
    resolvedAmount = Number(m.amount);
    resolvedCurrency = contract.currency;
    contractId = contract.id;
  }

  if (resolvedAmount == null || resolvedAmount <= 0) {
    respondError(res, 400, "amount_required", "amount is required when no milestone is provided");
    return;
  }

  // Idempotency: same (gateway, idempotencyKey) → return the existing PT.
  if (parsed.data.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(
        and(
          eq(paymentTransactionsTable.gateway, gatewayName),
          eq(paymentTransactionsTable.idempotencyKey, parsed.data.idempotencyKey),
        ),
      );
    if (existing) {
      const [existingIntent] = await db
        .select()
        .from(paymentIntentsTable)
        .where(eq(paymentIntentsTable.transactionId, existing.id))
        .orderBy(desc(paymentIntentsTable.createdAt));
      respond(res, {
        transaction: existing,
        intent: existingIntent ?? null,
        ...(gatewayName === "manual" ? { bankDetails: getManualBankDetails() } : {}),
        replayed: true,
      });
      return;
    }
  }

  // Race-safe insert. Two concurrent requests with the same idempotency key
  // could pass the read-before-insert check above; the UNIQUE constraint on
  // (gateway, idempotency_key) is the actual enforcement boundary. On a
  // 23505 violation, fall back to the replay path instead of bubbling 500.
  let tx: typeof paymentTransactionsTable.$inferSelect | undefined;
  try {
    const inserted = await db
      .insert(paymentTransactionsTable)
      .values({
        userId,
        contractId,
        milestoneId,
        gateway: gatewayName,
        amount: String(resolvedAmount),
        currency: resolvedCurrency,
        status: "INITIATED",
        paymentPurpose: parsed.data.paymentPurpose,
        idempotencyKey: parsed.data.idempotencyKey ?? null,
        metadata: parsed.data.metadata ?? {},
      })
      .returning();
    tx = inserted[0];
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505" && parsed.data.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(paymentTransactionsTable)
        .where(
          and(
            eq(paymentTransactionsTable.gateway, gatewayName),
            eq(paymentTransactionsTable.idempotencyKey, parsed.data.idempotencyKey),
          ),
        );
      if (existing) {
        const [existingIntent] = await db
          .select()
          .from(paymentIntentsTable)
          .where(eq(paymentIntentsTable.transactionId, existing.id))
          .orderBy(desc(paymentIntentsTable.createdAt));
        respond(res, {
          transaction: existing,
          intent: existingIntent ?? null,
          ...(gatewayName === "manual" ? { bankDetails: getManualBankDetails() } : {}),
          replayed: true,
        });
        return;
      }
    }
    throw err;
  }

  // Call the gateway adapter. On failure, mark PT FAILED and bubble the
  // error up to the caller as 502 (we created an audit trail row).
  let intentResult;
  try {
    intentResult = await gw.createIntent({
      amount: resolvedAmount,
      currency: resolvedCurrency,
      description: parsed.data.description ?? `Khidma transaction #${tx!.id}`,
      customerEmail: req.user!.email,
      customerName: req.user!.fullName,
      returnUrl: parsed.data.returnUrl,
      cancelUrl: parsed.data.cancelUrl,
      callbackUrl: webhookUrlFor(req, gatewayName),
      idempotencyKey: parsed.data.idempotencyKey,
      metadata: { ...(parsed.data.metadata ?? {}), transactionId: String(tx!.id) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gateway error";
    await db
      .update(paymentTransactionsTable)
      .set({ status: "FAILED", failureReason: message, updatedAt: new Date() })
      .where(eq(paymentTransactionsTable.id, tx!.id));
    respondError(res, 502, "gateway_error", message);
    return;
  }

  const newStatus =
    intentResult.status === "succeeded"
      ? "PAID"
      : intentResult.status === "requires_action"
        ? "REQUIRES_ACTION"
        : intentResult.status === "pending"
          ? "PENDING"
          : intentResult.status === "failed"
            ? "FAILED"
            : "INITIATED";

  await db
    .update(paymentTransactionsTable)
    .set({ gatewayReference: intentResult.intentId, status: newStatus, updatedAt: new Date() })
    .where(eq(paymentTransactionsTable.id, tx!.id));

  await db.insert(paymentIntentsTable).values({
    transactionId: tx!.id,
    gateway: gatewayName,
    intentRef: intentResult.intentId,
    clientSecret: intentResult.clientSecret ?? null,
    redirectUrl: intentResult.redirectUrl ?? null,
    status: intentResult.status,
    raw: (intentResult.raw as Record<string, unknown>) ?? {},
  });

  await audit(req, "payments.intent_created", "payment_transaction", tx!.id, {
    gateway: gatewayName,
    purpose: parsed.data.paymentPurpose,
    amount: resolvedAmount,
    currency: resolvedCurrency,
  });

  // If the gateway already says succeeded (mock fast-path), promote to escrow now.
  if (intentResult.status === "succeeded") {
    const refreshed = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.id, tx!.id));
    if (refreshed[0]) {
      await markTransactionPaidAndFundEscrow({
        transaction: refreshed[0],
        gatewayReference: intentResult.intentId,
        reason: "gateway succeeded synchronously",
      });
    }
  }

  const [finalTx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.id, tx!.id));

  respond(res, {
    transaction: finalTx,
    intent: {
      intentId: intentResult.intentId,
      clientSecret: intentResult.clientSecret,
      redirectUrl: intentResult.redirectUrl,
      status: intentResult.status,
    },
    ...(gatewayName === "manual" ? { bankDetails: getManualBankDetails() } : {}),
  });
});

function webhookUrlFor(req: Request, gateway: GatewayName): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers.host;
  const path = gateway === "stripe" ? "/api/payments/stripe/webhook" : `/api/payments/${gateway}/callback`;
  return `${proto}://${host}${path}`;
}

// ----------------------------------------------------------------------------
// GET /payments/transactions — list mine
// ----------------------------------------------------------------------------
router.get("/payments/transactions", requireAuth, async (req, res): Promise<void> => {
  const { page, perPage, offset } = parsePagination(req.query as Record<string, unknown>);
  const where = eq(paymentTransactionsTable.userId, req.user!.id);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentTransactionsTable)
    .where(where);
  const rows = await db
    .select()
    .from(paymentTransactionsTable)
    .where(where)
    .orderBy(desc(paymentTransactionsTable.createdAt))
    .limit(perPage)
    .offset(offset);
  respond(res, rows, { pagination: paginate(page, perPage, Number(count)) });
});

// ----------------------------------------------------------------------------
// GET /payments/transactions/:id — owner or admin
// ----------------------------------------------------------------------------
router.get("/payments/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    respondError(res, 400, "invalid_id", "Invalid transaction id");
    return;
  }
  const [tx] = await db.select().from(paymentTransactionsTable).where(eq(paymentTransactionsTable.id, id));
  if (!tx) {
    respondError(res, 404, "not_found", "Transaction not found");
    return;
  }
  if (tx.userId !== req.user!.id && req.user!.role !== "admin") {
    respondError(res, 403, "forbidden", "Not your transaction");
    return;
  }
  const intents = await db
    .select()
    .from(paymentIntentsTable)
    .where(eq(paymentIntentsTable.transactionId, id))
    .orderBy(desc(paymentIntentsTable.createdAt));
  respond(res, { transaction: tx, intents });
});

// ----------------------------------------------------------------------------
// Webhook handlers — one per gateway. Each:
//   1) verifies signature via the adapter
//   2) deduplicates on (gateway, eventId) via UNIQUE insert
//   3) updates the linked PT and fires escrow funding when mappedStatus=PAID
//   4) returns 200 even on duplicate so the gateway stops retrying
// ----------------------------------------------------------------------------
async function handleWebhook(
  gatewayName: GatewayName,
  signatureHeaderName: string,
  rawBody: Buffer | string,
  req: Request,
): Promise<{ status: number; body: unknown }> {
  const gw = getGatewayByName(gatewayName);
  if (!gw) return { status: 404, body: { error: { code: "unknown_gateway", message: "Unknown gateway" } } };
  const signature = String(req.header(signatureHeaderName) ?? "");
  let event;
  try {
    event = await gw.webhookVerify(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    logger.warn({ gateway: gatewayName, err: message }, "webhook verification failed");
    if (/not configured/i.test(message)) {
      return {
        status: 503,
        body: { error: { code: "gateway_not_configured", message } },
      };
    }
    return { status: 400, body: { error: { code: "invalid_signature", message } } };
  }

  // SECURITY GATE: hard-fail unverified webhooks for real gateways. The mock
  // gateway is dev-only and intentionally unsigned. Stripe will never reach
  // here with a bad sig (constructEvent throws and we return 400 above), but
  // PayTabs/Telr return signatureValid=false rather than throwing, and Telr
  // currently has no documented HMAC secret on the standard callback flow.
  // We persist the rejected event for audit, then return 400 so the gateway
  // either retries (with a hopefully-valid sig) or surfaces the failure.
  const requiresValidSignature =
    gatewayName === "stripe" || gatewayName === "paytabs" || gatewayName === "telr";
  if (requiresValidSignature && event.signatureValid !== true) {
    try {
      await db.insert(paymentWebhooksTable).values({
        gateway: gatewayName,
        eventId: event.id,
        eventType: event.type,
        signatureValid: false,
        raw: event.payload,
        processed: false,
        processError: "signature verification failed",
        processedAt: new Date(),
      });
    } catch {
      // Duplicate delivery of an unverified event — still reject.
    }
    logger.warn(
      { gateway: gatewayName, eventId: event.id, type: event.type },
      "webhook signature invalid — rejected, no state mutation",
    );
    return {
      status: 400,
      body: { error: { code: "invalid_signature", message: "Webhook signature verification failed" } },
    };
  }

  // Dedup on (gateway, eventId). UNIQUE constraint guarantees only the
  // first concurrent insert wins; subsequent calls just ack.
  let inserted: { id: number } | null = null;
  try {
    const [row] = await db
      .insert(paymentWebhooksTable)
      .values({
        gateway: gatewayName,
        eventId: event.id,
        eventType: event.type,
        signatureValid: event.signatureValid,
        raw: event.payload,
      })
      .returning({ id: paymentWebhooksTable.id });
    inserted = row ?? null;
  } catch (err) {
    // Likely UNIQUE violation = duplicate delivery. Ack with 200.
    logger.info({ gateway: gatewayName, eventId: event.id }, "webhook duplicate ignored");
    return { status: 200, body: { received: true, duplicate: true } };
  }

  // Look up the PT by gatewayReference and fund escrow if mappedStatus=PAID.
  let processed = false;
  let processError: string | null = null;
  if (event.gatewayReference) {
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(
        and(
          eq(paymentTransactionsTable.gateway, gatewayName),
          eq(paymentTransactionsTable.gatewayReference, event.gatewayReference),
        ),
      );
    if (tx) {
      try {
        if (event.mappedStatus === "PAID") {
          await markTransactionPaidAndFundEscrow({
            transaction: tx,
            gatewayReference: event.gatewayReference,
            reason: `webhook ${event.type}`,
          });
          processed = true;
        } else if (event.mappedStatus === "FAILED" || event.mappedStatus === "CANCELLED") {
          await db
            .update(paymentTransactionsTable)
            .set({
              status: event.mappedStatus,
              failureReason: `Webhook ${event.type}`,
              updatedAt: new Date(),
            })
            .where(eq(paymentTransactionsTable.id, tx.id));
          processed = true;
        } else if (event.mappedStatus === "REFUNDED") {
          await db
            .update(paymentTransactionsTable)
            .set({ status: "REFUNDED", refundedAt: new Date(), updatedAt: new Date() })
            .where(eq(paymentTransactionsTable.id, tx.id));
          processed = true;
        }
      } catch (err) {
        processError = err instanceof Error ? err.message : "processing failed";
        logger.error({ err, transactionId: tx.id }, "webhook processing failed");
      }
      if (inserted) {
        await db
          .update(paymentWebhooksTable)
          .set({ transactionId: tx.id, processed, processError, processedAt: new Date() })
          .where(eq(paymentWebhooksTable.id, inserted.id));
      }
    }
  }

  return { status: 200, body: { received: true, eventId: event.id, type: event.type, processed } };
}

router.post("/payments/stripe/webhook", async (req, res): Promise<void> => {
  // Raw body middleware in app.ts has already parsed this as a Buffer.
  const rawBody: Buffer | string = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body ?? {});
  const result = await handleWebhook("stripe", "stripe-signature", rawBody, req);
  res.status(result.status).json(result.body);
});

router.post("/payments/paytabs/callback", async (req, res): Promise<void> => {
  // PayTabs HMAC is computed over the exact bytes received; raw-body
  // middleware (app.ts) gives us a Buffer. Falling back to JSON.stringify
  // would re-serialize and break verification.
  const rawBody: Buffer | string = Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body ?? {});
  const result = await handleWebhook("paytabs", "signature", rawBody, req);
  res.status(result.status).json(result.body);
});

router.post("/payments/telr/callback", async (req, res): Promise<void> => {
  const rawBody: Buffer | string = Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body ?? {});
  const result = await handleWebhook("telr", "x-telr-signature", rawBody, req);
  res.status(result.status).json(result.body);
});

// Mock gateway webhook for local/test smoke runs.
router.post("/payments/mock/webhook", async (req, res): Promise<void> => {
  const rawBody: Buffer | string = Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body ?? {});
  const result = await handleWebhook("mock", "x-webhook-signature", rawBody, req);
  res.status(result.status).json(result.body);
});

// ----------------------------------------------------------------------------
// POST /payments/manual/submit-proof — client uploads proof of bank transfer.
// ----------------------------------------------------------------------------
const ManualProofBody = z.object({
  transactionId: z.number().int().positive(),
  attachmentId: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

router.post("/payments/manual/submit-proof", requireAuth, async (req, res): Promise<void> => {
  const parsed = ManualProofBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    respondError(res, 400, "validation_error", parsed.error.message);
    return;
  }
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.id, parsed.data.transactionId));
  if (!tx) {
    respondError(res, 404, "transaction_not_found", "Transaction not found");
    return;
  }
  if (tx.userId !== req.user!.id) {
    respondError(res, 403, "forbidden", "Not your transaction");
    return;
  }
  if (tx.gateway !== "manual") {
    respondError(res, 400, "wrong_gateway", "Proof upload is only for manual transactions");
    return;
  }
  if (tx.status !== "INITIATED" && tx.status !== "PENDING" && tx.status !== "REQUIRES_ACTION") {
    respondError(res, 409, "invalid_state", `Cannot attach proof to a ${tx.status} transaction`);
    return;
  }
  const [att] = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.id, parsed.data.attachmentId));
  if (!att || att.uploaderId !== req.user!.id) {
    respondError(res, 404, "attachment_not_found", "Attachment not found or not owned by you");
    return;
  }

  await db
    .update(paymentTransactionsTable)
    .set({
      status: "PENDING",
      proofAttachmentId: att.id,
      metadata: { ...(tx.metadata ?? {}), manualProofNote: parsed.data.note ?? null },
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactionsTable.id, tx.id));

  // Notify all admins so they can review.
  const admins = await db.select().from(usersTable).where(eq(usersTable.role, "admin"));
  await Promise.all(
    admins.map((a) =>
      notify({
        userId: a.id,
        kind: "moderation",
        title: "Manual payment proof submitted",
        body: `Transaction #${tx.id} (${tx.currency} ${tx.amount}) needs review`,
        link: `/admin/payments/transactions/${tx.id}`,
      }),
    ),
  );

  await audit(req, "payments.manual.proof_submitted", "payment_transaction", tx.id, {
    attachmentId: att.id,
  });

  respond(res, { transactionId: tx.id, status: "PENDING", proofAttachmentId: att.id });
});

export default router;
