import { createHmac, timingSafeEqual } from "node:crypto";
import { BRAND } from "@workspace/branding";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundResult,
  WebhookEvent,
} from "./gateway";

/**
 * PayTabs adapter — implements the real PayTabs hosted-payment-page
 * request structure (PT2 API). When PAYTABS_PROFILE_ID + PAYTABS_SERVER_KEY
 * are set the adapter performs a live POST to the regional endpoint;
 * otherwise it throws `not configured`.
 *
 * Docs: https://site.paytabs.com/en/paytabs-api-documentation/
 *
 * Region → host map (extend as needed):
 *   ARE: secure.paytabs.com   (UAE)
 *   SAU: secure.paytabs.sa    (KSA)
 *   OMN: secure-oman.paytabs.com
 *   JOR: secure-jordan.paytabs.com
 *   EGY: secure-egypt.paytabs.com
 *   GLOBAL: secure-global.paytabs.com
 */

const PROFILE_ID = process.env["PAYTABS_PROFILE_ID"];
const SERVER_KEY = process.env["PAYTABS_SERVER_KEY"];
const REGION = (process.env["PAYTABS_REGION"] ?? "ARE").toUpperCase();

const REGION_HOSTS: Record<string, string> = {
  ARE: "https://secure.paytabs.com",
  SAU: "https://secure.paytabs.sa",
  OMN: "https://secure-oman.paytabs.com",
  JOR: "https://secure-jordan.paytabs.com",
  EGY: "https://secure-egypt.paytabs.com",
  GLOBAL: "https://secure-global.paytabs.com",
};

function host(): string {
  return REGION_HOSTS[REGION] ?? REGION_HOSTS["ARE"]!;
}

export const paytabsGateway: PaymentGateway = {
  name: "paytabs",
  label: "PayTabs",
  get configured() {
    return Boolean(PROFILE_ID && SERVER_KEY);
  },
  supportedCurrencies: ["AED", "SAR", "USD", "EUR", "GBP", "OMR", "JOD", "EGP"],

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    if (!PROFILE_ID || !SERVER_KEY) {
      throw new Error(
        "PayTabs gateway is not configured. Set PAYTABS_PROFILE_ID + PAYTABS_SERVER_KEY.",
      );
    }
    const body = {
      profile_id: Number(PROFILE_ID),
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: input.idempotencyKey ?? `cart_${Date.now()}`,
      cart_description: input.description ?? `${BRAND.name} payment`,
      cart_currency: input.currency.toUpperCase(),
      cart_amount: input.amount,
      callback: input.callbackUrl,
      return: input.returnUrl,
      ...(input.customerEmail || input.customerName
        ? {
            customer_details: {
              name: input.customerName ?? "",
              email: input.customerEmail ?? "",
            },
          }
        : {}),
      user_defined: input.metadata ?? {},
    };
    const res = await fetch(`${host()}/payment/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: SERVER_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayTabs createIntent failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    const tranRef = String(json["tran_ref"] ?? json["transaction_ref"] ?? "");
    const redirectUrl = String(json["redirect_url"] ?? "");
    return {
      intentId: tranRef,
      redirectUrl: redirectUrl || undefined,
      status: redirectUrl ? "requires_action" : "pending",
      raw: json,
    };
  },

  async capture(intentId: string): Promise<PaymentIntentResult> {
    // PayTabs hosted page captures automatically; expose a query stub
    // that returns the last known status. Live callers should rely on
    // callbacks. TODO: implement /payment/query when needed.
    return { intentId, status: "pending", raw: { note: "PayTabs capture not implemented; rely on callback" } };
  },

  async refund(intentId: string, amount?: number): Promise<RefundResult> {
    if (!PROFILE_ID || !SERVER_KEY) {
      throw new Error("PayTabs gateway is not configured.");
    }
    const body = {
      profile_id: Number(PROFILE_ID),
      tran_type: "refund",
      tran_class: "ecom",
      cart_id: `refund_${intentId}_${Date.now()}`,
      cart_description: "Refund",
      cart_currency: "AED",
      cart_amount: amount ?? 0,
      tran_ref: intentId,
    };
    const res = await fetch(`${host()}/payment/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: SERVER_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayTabs refund failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return {
      refundId: String(json["tran_ref"] ?? `paytabs_re_${Date.now()}`),
      amount: amount ?? 0,
      status: "succeeded",
      raw: json,
    };
  },

  async webhookVerify(rawBody: Buffer | string, signature: string): Promise<WebhookEvent> {
    if (!SERVER_KEY) {
      throw new Error("PayTabs gateway is not configured.");
    }
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw new Error("PayTabs webhook body is not valid JSON");
    }
    // PayTabs IPN signature: HMAC-SHA256 of the raw body using SERVER_KEY.
    let signatureValid = false;
    if (signature) {
      const expected = createHmac("sha256", SERVER_KEY).update(body, "utf8").digest("hex");
      try {
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(signature.toLowerCase(), "hex");
        signatureValid = a.length === b.length && timingSafeEqual(a, b);
      } catch {
        signatureValid = false;
      }
    }
    const tranRef = String(parsed["tran_ref"] ?? "");
    const respStatus = String(parsed["payment_result"] && (parsed["payment_result"] as Record<string, unknown>)["response_status"] || "");
    let mappedStatus: WebhookEvent["mappedStatus"];
    if (respStatus === "A") mappedStatus = "PAID";
    else if (respStatus === "D") mappedStatus = "FAILED";
    else if (respStatus === "E") mappedStatus = "FAILED";
    else if (respStatus === "P") mappedStatus = "PENDING";
    return {
      id: tranRef || `paytabs_evt_${Date.now()}`,
      type: `paytabs.${respStatus || "unknown"}`,
      payload: parsed,
      signatureValid,
      gatewayReference: tranRef || undefined,
      mappedStatus,
    };
  },
};
