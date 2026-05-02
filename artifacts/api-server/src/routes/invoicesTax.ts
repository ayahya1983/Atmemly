import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable, platformSettingsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { respond, respondError } from "../lib/apiResponse";

const router: IRouter = Router();

async function getPlatformTrn(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, "platform_trn"));
  if (!row) return null;
  const v: unknown = row.value;
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v && "value" in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>)["value"];
    if (typeof inner === "string") return inner;
    if (typeof inner === "number") return String(inner);
  }
  // Last resort: stringify and unquote a JSON-encoded string value
  try {
    const s = JSON.stringify(v);
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  } catch {
    // ignore
  }
  return null;
}

router.get("/invoices/:id/tax-pdf-data", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    respondError(res, 400, "invalid_id", "Invalid invoice id");
    return;
  }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) {
    respondError(res, 404, "not_found", "Invoice not found");
    return;
  }
  const isOwn = invoice.clientId === req.user!.id || invoice.freelancerId === req.user!.id;
  if (!isOwn && req.user!.role !== "admin") {
    respondError(res, 403, "forbidden", "Forbidden");
    return;
  }
  const platformTrn = await getPlatformTrn();
  const reverseChargeNoteEn = invoice.reverseCharge
    ? "VAT applied under reverse-charge mechanism. Recipient is responsible for VAT accounting."
    : null;
  const reverseChargeNoteAr = invoice.reverseCharge
    ? "تطبق ضريبة القيمة المضافة وفقاً لآلية الاحتساب العكسي. المستلم مسؤول عن احتساب الضريبة."
    : null;
  respond(res, {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      vatPct: Number(invoice.vatPct),
      vatAmount: Number(invoice.vatAmount),
      total: Number(invoice.total),
      description: invoice.description,
      placeOfSupply: invoice.placeOfSupply,
      reverseCharge: invoice.reverseCharge,
      invoiceTypeCode: invoice.invoiceTypeCode,
      trn: invoice.trn,
    },
    platform: {
      trn: platformTrn,
      countryCode: "AE",
    },
    parties: {
      clientId: invoice.clientId,
      freelancerId: invoice.freelancerId,
    },
    notes: {
      reverseChargeEn: reverseChargeNoteEn,
      reverseChargeAr: reverseChargeNoteAr,
    },
  });
});

export default router;
