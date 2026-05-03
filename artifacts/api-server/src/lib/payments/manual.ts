import { randomUUID } from "node:crypto";
import { BRAND } from "@workspace/branding";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundResult,
  WebhookEvent,
} from "./gateway";

/**
 * Manual bank-transfer "gateway". Intent creation just allocates a
 * deterministic reference; the client is shown the platform's bank
 * details and uploads transfer proof. Admin approval is the
 * authoritative event that flips the transaction to PAID.
 *
 * Bank details are read from environment so the same instance can
 * support multiple banks per environment without code changes.
 */

export interface ManualBankDetails {
  accountName: string;
  bankName: string;
  iban: string;
  swift: string;
}

export function getManualBankDetails(): ManualBankDetails {
  return {
    accountName: process.env["MANUAL_BANK_ACCOUNT_NAME"] ?? BRAND.companyName,
    bankName: process.env["MANUAL_BANK_NAME"] ?? "Bank Name (configure MANUAL_BANK_NAME)",
    iban: process.env["MANUAL_BANK_IBAN"] ?? "AE000000000000000000000",
    swift: process.env["MANUAL_BANK_SWIFT"] ?? "XXXXAEXX",
  };
}

export const manualGateway: PaymentGateway = {
  name: "manual",
  label: "Manual bank transfer",
  configured: true,
  supportedCurrencies: ["AED", "USD", "EUR", "SAR", "GBP"],

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const ref = `manual_${input.idempotencyKey ?? randomUUID().slice(0, 12)}`;
    return {
      intentId: ref,
      status: "requires_action",
      raw: {
        bankDetails: getManualBankDetails(),
        instructions:
          "Transfer the exact amount including the reference in the payment description, then upload your transfer proof.",
        amount: input.amount,
        currency: input.currency,
      },
    };
  },

  async capture(intentId: string): Promise<PaymentIntentResult> {
    // Manual intents only resolve via admin approval — there's no
    // gateway to query. Caller should rely on transaction.status.
    return { intentId, status: "pending" };
  },

  async refund(intentId: string, amount?: number): Promise<RefundResult> {
    // Manual refunds are off-platform (bank transfer). We just record
    // the action and return success so accounting can proceed.
    return {
      refundId: `manual_re_${randomUUID().slice(0, 12)}`,
      amount: amount ?? 0,
      status: "succeeded",
      raw: { intentId, note: "Refund must be settled off-platform via bank transfer." },
    };
  },

  async webhookVerify(rawBody: Buffer | string): Promise<WebhookEvent> {
    // Manual gateway doesn't ship webhooks — the admin approval route
    // produces the authoritative state change. This stub exists only
    // so the interface stays uniform.
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      // ignore
    }
    return {
      id: String(parsed["id"] ?? `manual_evt_${randomUUID()}`),
      type: "manual.event",
      payload: parsed,
      signatureValid: true,
    };
  },
};
