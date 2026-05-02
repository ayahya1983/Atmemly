import { db, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { PaymentGateway } from "./gateway";
import { mockGateway } from "./mock";
import { stripeGateway } from "./stripe";
import { paytabsGateway } from "./paytabs";
import { telrGateway } from "./telr";
import { manualGateway } from "./manual";

export type GatewayName = "mock" | "stripe" | "paytabs" | "telr" | "manual";

const REGISTRY: Record<GatewayName, PaymentGateway> = {
  mock: mockGateway,
  stripe: stripeGateway,
  paytabs: paytabsGateway,
  telr: telrGateway,
  manual: manualGateway,
};

export const ALL_GATEWAY_NAMES: GatewayName[] = Object.keys(REGISTRY) as GatewayName[];

export function listGateways(): Array<{
  name: string;
  label: string;
  configured: boolean;
  supportedCurrencies: string[];
}> {
  return Object.values(REGISTRY).map((g) => ({
    name: g.name,
    label: g.label ?? g.name,
    configured: g.configured,
    supportedCurrencies: g.supportedCurrencies ?? [],
  }));
}

export async function getActiveGatewayName(): Promise<GatewayName> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "payment_gateway"));
  const v = row?.value;
  if (typeof v === "string" && v in REGISTRY) return v as GatewayName;
  if (
    v &&
    typeof v === "object" &&
    "value" in v &&
    typeof (v as { value: unknown }).value === "string"
  ) {
    const candidate = (v as { value: string }).value;
    if (candidate in REGISTRY) return candidate as GatewayName;
  }
  return "mock";
}

export async function getGateway(): Promise<PaymentGateway> {
  const name = await getActiveGatewayName();
  return REGISTRY[name];
}

export function getGatewayByName(name: string): PaymentGateway | null {
  return (REGISTRY as Record<string, PaymentGateway | undefined>)[name] ?? null;
}

export type { PaymentGateway } from "./gateway";
export { getManualBankDetails } from "./manual";
