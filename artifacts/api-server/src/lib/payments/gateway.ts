export type PaymentPurpose =
  | "contract_funding"
  | "milestone_funding"
  | "subscription"
  | "featured_listing"
  | "other";

export interface PaymentIntentInput {
  amount: number;
  currency: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  intentId: string;
  clientSecret?: string;
  redirectUrl?: string;
  status: "requires_payment" | "requires_action" | "succeeded" | "pending" | "failed";
  raw?: unknown;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: "succeeded" | "pending" | "failed";
  raw?: unknown;
}

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  /** Did the gateway-level signature verification succeed? Always true for
   * gateways that don't have a signature scheme; false-positive prevented
   * by adapter-level checks. */
  signatureValid: boolean;
  /** Optional reference back to the gateway intent/transaction the event
   * relates to — extracted by the adapter so the upstream handler can
   * dispatch without re-parsing the payload shape. */
  gatewayReference?: string;
  /** Mapped status the upstream handler should apply to the transaction. */
  mappedStatus?:
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "REQUIRES_ACTION"
    | "PENDING";
}

export interface PaymentGateway {
  name: string;
  configured: boolean;
  /** Display label for admin UIs. */
  label?: string;
  /** Currencies the gateway can process. Empty = no constraint. */
  supportedCurrencies?: string[];
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  capture(intentId: string): Promise<PaymentIntentResult>;
  refund(intentId: string, amount?: number): Promise<RefundResult>;
  /**
   * Verify and parse a webhook payload. `rawBody` MUST be the raw bytes
   * (or string) as received — DO NOT pre-parse to JSON, as gateways
   * (Stripe) sign over the exact bytes.
   */
  webhookVerify(rawBody: Buffer | string, signature: string): Promise<WebhookEvent>;
}
