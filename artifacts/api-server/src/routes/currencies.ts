import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db, currenciesTable, fxRatesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";
import { convert, getActiveCurrencies, getLatestRate } from "../lib/currency";

const router: IRouter = Router();

router.get("/currencies", async (_req, res): Promise<void> => {
  const rows = await getActiveCurrencies();
  respond(res, rows);
});

router.get("/fx-rates", async (req, res): Promise<void> => {
  const base = String(req.query["base"] ?? "AED").toUpperCase();
  const quote = req.query["quote"] ? String(req.query["quote"]).toUpperCase() : null;
  if (quote) {
    const rate = await getLatestRate(base, quote);
    if (rate == null) {
      respondError(res, 404, "rate_not_found", `No FX rate for ${base}->${quote}`);
      return;
    }
    respond(res, { base, quote, rate });
    return;
  }
  const rows = await db
    .select()
    .from(fxRatesTable)
    .where(eq(fxRatesTable.base, base))
    .orderBy(desc(fxRatesTable.fetchedAt))
    .limit(50);
  respond(res, rows);
});

router.get("/fx-convert", async (req, res): Promise<void> => {
  const amount = Number(req.query["amount"]);
  const from = String(req.query["from"] ?? "AED").toUpperCase();
  const to = String(req.query["to"] ?? "AED").toUpperCase();
  if (!Number.isFinite(amount)) {
    respondError(res, 400, "invalid_amount", "amount must be a number");
    return;
  }
  const result = await convert(amount, from, to);
  if (!result) {
    respondError(res, 404, "rate_not_found", `No FX rate for ${from}->${to}`);
    return;
  }
  respond(res, result);
});

const FxBody = z.object({
  base: z.string().length(3),
  quote: z.string().length(3),
  rate: z.number().positive(),
  source: z.string().max(64).optional(),
});

router.post(
  "/admin/fx-rates",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = FxBody.safeParse(req.body);
    if (!parsed.success) {
      respondError(res, 400, "validation_error", parsed.error.message);
      return;
    }
    const [row] = await db
      .insert(fxRatesTable)
      .values({
        base: parsed.data.base.toUpperCase(),
        quote: parsed.data.quote.toUpperCase(),
        rate: String(parsed.data.rate),
        source: parsed.data.source ?? "manual",
      })
      .returning();
    respond(res, row);
  },
);

router.post(
  "/admin/fx-rates/refresh",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [latest] = await db
      .select()
      .from(fxRatesTable)
      .orderBy(desc(fxRatesTable.fetchedAt))
      .limit(1);
    const ageSec = latest ? Math.round((Date.now() - new Date(latest.fetchedAt).getTime()) / 1000) : null;
    respond(res, {
      provider: "stub",
      refreshed: false,
      latestFetchedAt: latest?.fetchedAt ?? null,
      ageSec,
      hint: "Set FX_PROVIDER + FX_PROVIDER_KEY to enable scheduled refresh.",
    });
  },
);

const _ensureUnused = and; // keep import used
void _ensureUnused;

export default router;
