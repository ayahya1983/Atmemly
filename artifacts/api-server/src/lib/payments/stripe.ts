import type { PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundResult, WebhookEvent } from "./gateway";

const NOT_CONFIGURED = new Error(
  "Stripe gateway is not configured. Set STRIPE_SECRET_KEY and switch the `payment_gateway` setting to `stripe`.",
);

export const stripeGateway: PaymentGateway = {
  name: "stripe",
  configured: false,
  async createIntent(_input: PaymentIntentInput): Promise<PaymentIntentResult> {
    throw NOT_CONFIGURED;
  },
  async capture(_intentId: string): Promise<PaymentIntentResult> {
    throw NOT_CONFIGURED;
  },
  async refund(_intentId: string, _amount?: number): Promise<RefundResult> {
    throw NOT_CONFIGURED;
  },
  async webhookVerify(_raw: Buffer | string, _sig: string): Promise<WebhookEvent> {
    throw NOT_CONFIGURED;
  },
};
