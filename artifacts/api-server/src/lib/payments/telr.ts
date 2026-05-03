import { BRAND } from "@workspace/branding";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundResult,
  WebhookEvent,
} from "./gateway";

/**
 * Telr adapter — implements the real Telr hosted-payment-page
 * request/response structure. When TELR_STORE_ID + TELR_AUTH_KEY are
 * set the adapter performs a live POST to gateway.telr.com; otherwise
 * it throws `not configured`.
 *
 * Docs: https://telr.com/support/api/integration/integration-guide-2/
 * Endpoint: https://secure.telr.com/gateway/order.json
 *
 * Telr does NOT send signed webhooks — instead the merchant queries
 * order status on the return URL via /gateway/order/query. Until that
 * is wired we mark webhook signatureValid=false but still parse the
 * status field.
 */

const STORE_ID = process.env["TELR_STORE_ID"];
const AUTH_KEY = process.env["TELR_AUTH_KEY"];
const TEST_MODE = (process.env["TELR_TEST_MODE"] ?? "1") === "1";

const ENDPOINT = "https://secure.telr.com/gateway/order.json";

export const telrGateway: PaymentGateway = {
  name: "telr",
  label: "Telr",
  get configured() {
    return Boolean(STORE_ID && AUTH_KEY);
  },
  supportedCurrencies: ["AED", "SAR", "USD", "EUR", "GBP"],

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    if (!STORE_ID || !AUTH_KEY) {
      throw new Error("Telr gateway is not configured. Set TELR_STORE_ID + TELR_AUTH_KEY.");
    }
    const body = {
      ivp_method: "create",
      ivp_store: Number(STORE_ID),
      ivp_authkey: AUTH_KEY,
      ivp_cart: input.idempotencyKey ?? `cart_${Date.now()}`,
      ivp_test: TEST_MODE ? 1 : 0,
      ivp_amount: input.amount.toFixed(2),
      ivp_currency: input.currency.toUpperCase(),
      ivp_desc: input.description ?? `${BRAND.name} payment`,
      return_auth: input.returnUrl,
      return_decl: input.cancelUrl ?? input.returnUrl,
      return_can: input.cancelUrl ?? input.returnUrl,
      ...(input.customerEmail || input.customerName
        ? {
            bill_fname: (input.customerName ?? "").split(" ")[0],
            bill_sname: (input.customerName ?? "").split(" ").slice(1).join(" "),
            bill_email: input.customerEmail,
          }
        : {}),
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Telr createIntent failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    const order = (json["order"] ?? {}) as Record<string, unknown>;
    if (json["error"]) {
      const err = json["error"] as Record<string, unknown>;
      throw new Error(`Telr error: ${String(err["message"] ?? "unknown")}`);
    }
    const orderRef = String(order["ref"] ?? "");
    const url = String(order["url"] ?? "");
    return {
      intentId: orderRef,
      redirectUrl: url || undefined,
      status: url ? "requires_action" : "pending",
      raw: json,
    };
  },

  async capture(intentId: string): Promise<PaymentIntentResult> {
    if (!STORE_ID || !AUTH_KEY) {
      throw new Error("Telr gateway is not configured.");
    }
    const body = {
      ivp_method: "check",
      ivp_store: Number(STORE_ID),
      ivp_authkey: AUTH_KEY,
      order_ref: intentId,
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    const order = (json["order"] ?? {}) as Record<string, unknown>;
    const status = String((order["status"] as Record<string, unknown>)?.["text"] ?? "");
    const mapped: PaymentIntentResult["status"] = /paid|approved|authorised/i.test(status)
      ? "succeeded"
      : /pending/i.test(status)
        ? "pending"
        : /declined|cancelled|failed/i.test(status)
          ? "failed"
          : "pending";
    return { intentId, status: mapped, raw: json };
  },

  async refund(_intentId: string, _amount?: number): Promise<RefundResult> {
    // Telr refund requires merchant-portal action or remote API; not
    // implemented in MVP. Leave this throwing so we never silently
    // claim a refund succeeded.
    throw new Error("Telr refunds must be performed via the Telr merchant dashboard.");
  },

  async webhookVerify(rawBody: Buffer | string, _signature: string): Promise<WebhookEvent> {
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      // Telr can also POST application/x-www-form-urlencoded; fall back.
      const params = new URLSearchParams(body);
      parsed = Object.fromEntries(params);
    }
    const orderRef = String(parsed["order_ref"] ?? parsed["cart_id"] ?? "");
    const statusText = String(parsed["status"] ?? parsed["tran_status"] ?? "");
    let mappedStatus: WebhookEvent["mappedStatus"];
    if (/paid|approved|authorised/i.test(statusText)) mappedStatus = "PAID";
    else if (/declined|cancelled/i.test(statusText)) mappedStatus = "FAILED";
    else if (/pending/i.test(statusText)) mappedStatus = "PENDING";
    return {
      id: orderRef || `telr_evt_${Date.now()}`,
      type: `telr.${statusText || "unknown"}`,
      payload: parsed,
      // Telr has no built-in signature on callbacks — rely on a
      // server-to-server check via capture() before trusting status.
      signatureValid: false,
      gatewayReference: orderRef || undefined,
      mappedStatus,
    };
  },
};
