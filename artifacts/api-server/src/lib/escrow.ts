import { eq, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  walletTransactionsTable,
  invoicesTable,
  type Wallet,
} from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | Tx;

export async function ensureWallet(
  userId: number,
  currency = "AED",
  client: DbClient = db,
): Promise<Wallet> {
  const [existing] = await client
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));
  if (existing) return existing;
  const [created] = await client
    .insert(walletsTable)
    .values({ userId, currency })
    .returning();
  return created!;
}

export type WalletTxKind =
  | "credit_pending"
  | "release"
  | "fee"
  | "payout"
  | "refund"
  | "adjustment";

export async function recordWalletTransaction(
  opts: {
    walletId: number;
    type: WalletTxKind;
    amount: number;
    currency: string;
    refType?: string | null;
    refId?: number | null;
    note?: string | null;
  },
  client: DbClient = db,
): Promise<void> {
  await client.insert(walletTransactionsTable).values({
    walletId: opts.walletId,
    type: opts.type,
    amount: String(opts.amount),
    currency: opts.currency,
    refType: opts.refType ?? null,
    refId: opts.refId ?? null,
    note: opts.note ?? null,
  });
}

export async function addPendingBalance(
  userId: number,
  amount: number,
  currency: string,
  refType: string,
  refId: number,
  note?: string,
  client: DbClient = db,
): Promise<void> {
  const wallet = await ensureWallet(userId, currency, client);
  await client
    .update(walletsTable)
    .set({
      pendingBalance: sql`${walletsTable.pendingBalance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(walletsTable.id, wallet.id));
  await recordWalletTransaction(
    {
      walletId: wallet.id,
      type: "credit_pending",
      amount,
      currency,
      refType,
      refId,
      note,
    },
    client,
  );
}

/**
 * Move funds from pending → available, deducting platform fee.
 * Returns { feeAmount, netAmount }.
 * Uses a guarded UPDATE so it cannot drive pendingBalance below zero
 * even under concurrent calls — the WHERE clause requires sufficient
 * pending funds. Caller MUST run this inside a transaction.
 */
export async function releaseToWallet(
  userId: number,
  grossAmount: number,
  feePct: number,
  currency: string,
  refType: string,
  refId: number,
  client: DbClient = db,
): Promise<{ feeAmount: number; netAmount: number }> {
  const wallet = await ensureWallet(userId, currency, client);
  const feeAmount = Math.round(grossAmount * (feePct / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;
  const updated = await client
    .update(walletsTable)
    .set({
      pendingBalance: sql`${walletsTable.pendingBalance} - ${grossAmount}`,
      availableBalance: sql`${walletsTable.availableBalance} + ${netAmount}`,
      lifetimeEarnings: sql`${walletsTable.lifetimeEarnings} + ${netAmount}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${walletsTable.id} = ${wallet.id} and ${walletsTable.pendingBalance} >= ${grossAmount}`,
    )
    .returning({ id: walletsTable.id });
  if (updated.length === 0) {
    throw new Error(
      `Wallet release blocked: insufficient pending balance for user ${userId} (need ${grossAmount}).`,
    );
  }
  await recordWalletTransaction(
    {
      walletId: wallet.id,
      type: "release",
      amount: netAmount,
      currency,
      refType,
      refId,
      note: `Released after fee (gross ${grossAmount}, fee ${feeAmount})`,
    },
    client,
  );
  if (feeAmount > 0) {
    await recordWalletTransaction(
      {
        walletId: wallet.id,
        type: "fee",
        amount: -feeAmount,
        currency,
        refType,
        refId,
        note: `Platform fee ${feePct}%`,
      },
      client,
    );
  }
  return { feeAmount, netAmount };
}

/**
 * Atomically debit available balance. Returns true if the debit succeeded,
 * false if the wallet had insufficient funds (no rows affected).
 * Caller is responsible for the transactional context.
 */
export async function debitAvailable(
  userId: number,
  amount: number,
  currency: string,
  refType: string,
  refId: number,
  note?: string,
  client: DbClient = db,
): Promise<boolean> {
  const wallet = await ensureWallet(userId, currency, client);
  const updated = await client
    .update(walletsTable)
    .set({
      availableBalance: sql`${walletsTable.availableBalance} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      sql`${walletsTable.id} = ${wallet.id} and ${walletsTable.availableBalance} >= ${amount}`,
    )
    .returning({ id: walletsTable.id });
  if (updated.length === 0) return false;
  await recordWalletTransaction(
    {
      walletId: wallet.id,
      type: "payout",
      amount: -amount,
      currency,
      refType,
      refId,
      note: note ?? null,
    },
    client,
  );
  return true;
}

let invoiceCounter = 0;
export function generateInvoiceNumber(): string {
  invoiceCounter += 1;
  const yyyy = new Date().getFullYear();
  const ts = Date.now().toString().slice(-7);
  const seq = String(invoiceCounter).padStart(3, "0");
  return `INV-${yyyy}-${ts}-${seq}`;
}

export async function generateInvoice(
  opts: {
    contractId: number | null;
    milestoneId: number | null;
    paymentId: number | null;
    clientId: number;
    freelancerId: number;
    description: string;
    subtotal: number;
    vatPct?: number;
    currency?: string;
  },
  client: DbClient = db,
): Promise<{ id: number; invoiceNumber: string }> {
  const vatPct = opts.vatPct ?? 5;
  const vatAmount = Math.round(opts.subtotal * (vatPct / 100) * 100) / 100;
  const total = Math.round((opts.subtotal + vatAmount) * 100) / 100;
  const invoiceNumber = generateInvoiceNumber();
  const [row] = await client
    .insert(invoicesTable)
    .values({
      invoiceNumber,
      contractId: opts.contractId,
      milestoneId: opts.milestoneId,
      paymentId: opts.paymentId,
      clientId: opts.clientId,
      freelancerId: opts.freelancerId,
      description: opts.description,
      subtotal: String(opts.subtotal),
      vatPct: String(vatPct),
      vatAmount: String(vatAmount),
      total: String(total),
      currency: opts.currency ?? "AED",
    })
    .returning({ id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber });
  return { id: row!.id, invoiceNumber: row!.invoiceNumber };
}
