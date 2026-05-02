export interface PaymentIntentInput {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  intentId: string;
  clientSecret?: string;
  status: "requires_payment" | "succeeded" | "failed";
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
}

export interface PaymentGateway {
  name: string;
  configured: boolean;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  capture(intentId: string): Promise<PaymentIntentResult>;
  refund(intentId: string, amount?: number): Promise<RefundResult>;
  webhookVerify(rawBody: Buffer | string, signature: string): Promise<WebhookEvent>;
}
