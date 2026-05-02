import { db, escrowEventsTable } from "@workspace/db";
import type { DbClient } from "./escrow";

export type EscrowState =
  | "held"
  | "released"
  | "partial_released"
  | "refunded"
  | "dispute_held"
  | "expired_returned";

export interface RecordEscrowEventInput {
  contractId?: number | null;
  milestoneId?: number | null;
  paymentId?: number | null;
  fromState?: string | null;
  toState: EscrowState;
  amount?: number | null;
  currency?: string;
  actorUserId?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordEscrowEvent(
  input: RecordEscrowEventInput,
  client: DbClient = db,
): Promise<void> {
  await client.insert(escrowEventsTable).values({
    contractId: input.contractId ?? null,
    milestoneId: input.milestoneId ?? null,
    paymentId: input.paymentId ?? null,
    fromState: input.fromState ?? null,
    toState: input.toState,
    amount: input.amount != null ? String(input.amount) : null,
    currency: input.currency ?? "AED",
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}
