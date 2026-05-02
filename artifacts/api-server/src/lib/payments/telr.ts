import type { PaymentGateway, PaymentIntentInput, PaymentIntentResult, RefundResult, WebhookEvent } from "./gateway";

const NOT_CONFIGURED = new Error(
  "Telr gateway is not configured. Set TELR_STORE_ID + TELR_AUTH_KEY and switch the `payment_gateway` setting to `telr`.",
);

export const telrGateway: PaymentGateway = {
  name: "telr",
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
