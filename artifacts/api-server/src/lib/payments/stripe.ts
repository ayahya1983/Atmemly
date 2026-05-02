import Stripe from "stripe";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundResult,
  WebhookEvent,
} from "./gateway";

const SECRET_KEY = process.env["STRIPE_SECRET_KEY"];
const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"];

let _client: Stripe | null = null;
function client(): Stripe {
  if (!SECRET_KEY) {
    throw new Error(
      "Stripe gateway is not configured. Set STRIPE_SECRET_KEY to enable.",
    );
  }
  if (!_client) {
    _client = new Stripe(SECRET_KEY, { typescript: true });
  }
  return _client;
}

/** Stripe smallest-currency-unit conversion. AED uses 2 decimals so amount
 * 12.34 → 1234. We treat ALL supported currencies as 2-decimal here; if
 * you add JPY etc. expand this map. */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

function fromMinorUnits(amount: number | null | undefined): number {
  if (amount == null) return 0;
  return Math.round(amount) / 100;
}

const STATUS_MAP: Record<string, PaymentIntentResult["status"]> = {
  requires_payment_method: "requires_payment",
  requires_confirmation: "requires_payment",
  requires_action: "requires_action",
  processing: "pending",
  requires_capture: "pending",
  succeeded: "succeeded",
  canceled: "failed",
};

export const stripeGateway: PaymentGateway = {
  name: "stripe",
  label: "Stripe",
  get configured() {
    return Boolean(SECRET_KEY);
  },
  supportedCurrencies: ["AED", "USD", "EUR", "GBP", "SAR"],

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const c = client();
    const intent = await c.paymentIntents.create(
      {
        amount: toMinorUnits(input.amount),
        currency: input.currency.toLowerCase(),
        description: input.description,
        receipt_email: input.customerEmail,
        automatic_payment_methods: { enabled: true },
        metadata: input.metadata ?? {},
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    return {
      intentId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: STATUS_MAP[intent.status] ?? "pending",
      raw: { id: intent.id, status: intent.status },
    };
  },

  async capture(intentId: string): Promise<PaymentIntentResult> {
    const c = client();
    const intent = await c.paymentIntents.retrieve(intentId);
    return {
      intentId: intent.id,
      status: STATUS_MAP[intent.status] ?? "pending",
      raw: { id: intent.id, status: intent.status },
    };
  },

  async refund(intentId: string, amount?: number): Promise<RefundResult> {
    const c = client();
    const refund = await c.refunds.create({
      payment_intent: intentId,
      ...(amount != null ? { amount: toMinorUnits(amount) } : {}),
    });
    const status =
      refund.status === "succeeded"
        ? "succeeded"
        : refund.status === "pending"
          ? "pending"
          : "failed";
    return {
      refundId: refund.id,
      amount: fromMinorUnits(refund.amount),
      status,
      raw: { id: refund.id, status: refund.status },
    };
  },

  async webhookVerify(
    rawBody: Buffer | string,
    signature: string,
  ): Promise<WebhookEvent> {
    if (!WEBHOOK_SECRET) {
      throw new Error(
        "Stripe webhook secret missing. Set STRIPE_WEBHOOK_SECRET to verify events.",
      );
    }
    const c = client();
    const event = c.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
    let mappedStatus: WebhookEvent["mappedStatus"];
    let gatewayReference: string | undefined;
    const dataObject = (event.data?.object ?? {}) as unknown as Record<string, unknown>;
    const refField = dataObject["payment_intent"] ?? dataObject["id"];
    if (typeof refField === "string") gatewayReference = refField;
    switch (event.type) {
      case "payment_intent.succeeded":
      case "checkout.session.completed":
        mappedStatus = "PAID";
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        mappedStatus = "FAILED";
        break;
      case "charge.refunded":
      case "charge.refund.updated":
        mappedStatus = "REFUNDED";
        break;
      case "payment_intent.requires_action":
        mappedStatus = "REQUIRES_ACTION";
        break;
      default:
        mappedStatus = undefined;
    }
    return {
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
      signatureValid: true,
      gatewayReference,
      mappedStatus,
    };
  },
};
