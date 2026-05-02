import { randomUUID } from "node:crypto";
import type { PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundResult, WebhookEvent } from "./gateway";

export const mockGateway: PaymentGateway = {
  name: "mock",
  configured: true,
  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      intentId: `mock_${randomUUID()}`,
      clientSecret: `mock_secret_${randomUUID()}`,
      status: "requires_payment",
      raw: { input },
    };
  },
  async capture(intentId: string): Promise<PaymentIntentResult> {
    return { intentId, status: "succeeded" };
  },
  async refund(intentId: string, amount?: number): Promise<RefundResult> {
    return { refundId: `mock_re_${randomUUID()}`, amount: amount ?? 0, status: "succeeded", raw: { intentId } };
  },
  async webhookVerify(rawBody: Buffer | string): Promise<WebhookEvent> {
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      // ignore — empty event
    }
    const mappedRaw = String(parsed["mappedStatus"] ?? "");
    const allowed = ["PAID","FAILED","CANCELLED","REFUNDED","PARTIALLY_REFUNDED","REQUIRES_ACTION","PENDING"] as const;
    const mappedStatus = (allowed as readonly string[]).includes(mappedRaw)
      ? (mappedRaw as (typeof allowed)[number])
      : undefined;
    return {
      id: String(parsed["id"] ?? `mock_evt_${randomUUID()}`),
      type: String(parsed["type"] ?? "mock.event"),
      payload: parsed,
      signatureValid: true,
      gatewayReference: typeof parsed["gatewayReference"] === "string" ? (parsed["gatewayReference"] as string) : undefined,
      mappedStatus,
    };
  },
};
