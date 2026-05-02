import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  walletTransactionsTable,
  payoutsTable,
} from "@workspace/db";
import {
  GetMyWalletResponse,
  RequestPayoutBody,
  RequestPayoutResponse,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";
import { ensureWallet } from "../lib/escrow";

const router: IRouter = Router();

router.get("/wallet/me", requireAuth, async (req, res): Promise<void> => {
  const wallet = await ensureWallet(req.user!.id);
  const txs = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.walletId, wallet.id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(50);
  res.json(
    GetMyWalletResponse.parse({
      userId: wallet.userId,
      currency: wallet.currency,
      availableBalance: Number(wallet.availableBalance),
      pendingBalance: Number(wallet.pendingBalance),
      lifetimeEarnings: Number(wallet.lifetimeEarnings),
      transactions: txs.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        currency: t.currency,
        refType: t.refType,
        refId: t.refId,
        note: t.note,
        createdAt: t.createdAt,
      })),
    }),
  );
});

router.post(
  "/wallet/payouts",
  requireAuth,
  requireRole("freelancer"),
  async (req, res): Promise<void> => {
    const parsed = RequestPayoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.amount <= 0) {
      res.status(400).json({ error: "Amount must be positive" });
      return;
    }
    const wallet = await ensureWallet(req.user!.id);
    let payout: typeof payoutsTable.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        // Atomic guarded debit. UPDATE only succeeds if the wallet still has the funds —
        // concurrent requests racing for the same balance will result in zero rows touched
        // for the loser, which we surface as INSUFFICIENT_FUNDS.
        const debited = await tx
          .update(walletsTable)
          .set({
            availableBalance: sql`${walletsTable.availableBalance} - ${parsed.data.amount}`,
            updatedAt: new Date(),
          })
          .where(
            sql`${walletsTable.id} = ${wallet.id} and ${walletsTable.availableBalance} >= ${parsed.data.amount}`,
          )
          .returning({ id: walletsTable.id });
        if (debited.length === 0) {
          throw Object.assign(new Error("Insufficient available balance"), {
            code: "INSUFFICIENT_FUNDS",
          });
        }
        const [created] = await tx
          .insert(payoutsTable)
          .values({
            freelancerId: req.user!.id,
            amount: String(parsed.data.amount),
            currency: wallet.currency,
            status: "requested",
            note: parsed.data.note ?? null,
          })
          .returning();
        payout = created;
        await tx.insert(walletTransactionsTable).values({
          walletId: wallet.id,
          type: "payout",
          amount: String(-parsed.data.amount),
          currency: wallet.currency,
          refType: "payout",
          refId: created!.id,
          note: "Payout requested (held until processed)",
        });
      });
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "INSUFFICIENT_FUNDS") {
        res.status(400).json({ error: "Insufficient available balance" });
        return;
      }
      throw e;
    }
    await audit(req, "payout.request", "payout", payout!.id, { amount: parsed.data.amount });
    res.json(
      RequestPayoutResponse.parse({
        id: payout!.id,
        freelancerId: payout!.freelancerId,
        freelancerName: req.user!.fullName,
        amount: Number(payout!.amount),
        currency: payout!.currency,
        status: payout!.status,
        method: payout!.method,
        note: payout!.note,
        reference: payout!.reference,
        requestedAt: payout!.requestedAt,
        processedAt: payout!.processedAt,
        processedBy: payout!.processedBy,
      }),
    );
  },
);

export default router;
