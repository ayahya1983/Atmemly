import { db, currenciesTable, fxRatesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

export async function getActiveCurrencies() {
  return db.select().from(currenciesTable).where(eq(currenciesTable.isActive, true));
}

export async function getLatestRate(base: string, quote: string): Promise<number | null> {
  if (base === quote) return 1;
  const [row] = await db
    .select()
    .from(fxRatesTable)
    .where(and(eq(fxRatesTable.base, base), eq(fxRatesTable.quote, quote)))
    .orderBy(desc(fxRatesTable.fetchedAt))
    .limit(1);
  if (!row) return null;
  return Number(row.rate);
}

export async function convert(amount: number, from: string, to: string): Promise<{ amount: number; rate: number; from: string; to: string } | null> {
  const rate = await getLatestRate(from, to);
  if (rate == null) return null;
  return { amount: Math.round(amount * rate * 1e6) / 1e6, rate, from, to };
}
