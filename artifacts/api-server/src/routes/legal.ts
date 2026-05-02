import { Router, type IRouter } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  legalDocumentsTable,
  consentsTable,
} from "@workspace/db";
import { requireAuth, requireRole, clientIp, clientUa } from "../lib/auth";
import { audit } from "../lib/audit";

const router: IRouter = Router();

const PublishLegalBody = z.object({
  slug: z.string().min(2).max(64),
  titleEn: z.string().min(1).max(200),
  titleAr: z.string().min(1).max(200),
  bodyEn: z.string().min(1),
  bodyAr: z.string().min(1),
});

const RecordConsentBody = z.object({
  documentSlug: z.string().min(2).max(64),
});

function publicDoc(d: typeof legalDocumentsTable.$inferSelect) {
  return {
    id: d.id,
    slug: d.slug,
    version: d.version,
    titleEn: d.titleEn,
    titleAr: d.titleAr,
    bodyEn: d.bodyEn,
    bodyAr: d.bodyAr,
    publishedAt: d.publishedAt,
  };
}

router.get("/legal/:slug", async (req, res): Promise<void> => {
  const slug = req.params["slug"] ?? "";
  const lang = req.query["lang"] === "ar" ? "ar" : "en";
  const [doc] = await db
    .select()
    .from(legalDocumentsTable)
    .where(and(eq(legalDocumentsTable.slug, slug), eq(legalDocumentsTable.isCurrent, true)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({
    id: doc.id,
    slug: doc.slug,
    version: doc.version,
    lang,
    title: lang === "ar" ? doc.titleAr : doc.titleEn,
    body: lang === "ar" ? doc.bodyAr : doc.bodyEn,
    titleEn: doc.titleEn,
    titleAr: doc.titleAr,
    bodyEn: doc.bodyEn,
    bodyAr: doc.bodyAr,
    publishedAt: doc.publishedAt,
  });
});

router.get(
  "/admin/legal/:slug/versions",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const slug = req.params["slug"] ?? "";
    const rows = await db
      .select()
      .from(legalDocumentsTable)
      .where(eq(legalDocumentsTable.slug, slug))
      .orderBy(desc(legalDocumentsTable.version));
    res.json(rows.map(publicDoc));
  },
);

router.post(
  "/admin/legal",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = PublishLegalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const result = await db.transaction(async (tx) => {
      const [last] = await tx
        .select({ v: sql<number>`coalesce(max(version), 0)::int` })
        .from(legalDocumentsTable)
        .where(eq(legalDocumentsTable.slug, d.slug));
      const nextVersion = (last?.v ?? 0) + 1;
      await tx
        .update(legalDocumentsTable)
        .set({ isCurrent: false })
        .where(eq(legalDocumentsTable.slug, d.slug));
      const [inserted] = await tx
        .insert(legalDocumentsTable)
        .values({
          slug: d.slug,
          version: nextVersion,
          titleEn: d.titleEn,
          titleAr: d.titleAr,
          bodyEn: d.bodyEn,
          bodyAr: d.bodyAr,
          isCurrent: true,
          publishedById: req.user!.id,
        })
        .returning();
      return inserted!;
    });
    await audit(req, "legal.publish", "legal_document", result.id, {
      slug: result.slug,
      version: result.version,
    });
    res.json(publicDoc(result));
  },
);

router.post("/consents", requireAuth, async (req, res): Promise<void> => {
  const parsed = RecordConsentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [doc] = await db
    .select()
    .from(legalDocumentsTable)
    .where(
      and(
        eq(legalDocumentsTable.slug, parsed.data.documentSlug),
        eq(legalDocumentsTable.isCurrent, true),
      ),
    );
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const [row] = await db
    .insert(consentsTable)
    .values({
      userId: req.user!.id,
      documentId: doc.id,
      documentSlug: doc.slug,
      documentVersion: doc.version,
      ip: clientIp(req) || null,
      userAgent: clientUa(req) || null,
    })
    .returning();
  await audit(req, "consent.record", "legal_document", doc.id, {
    slug: doc.slug,
    version: doc.version,
  });
  res.json({
    id: row!.id,
    documentId: row!.documentId,
    documentSlug: row!.documentSlug,
    documentVersion: row!.documentVersion,
    acceptedAt: row!.acceptedAt,
  });
});

router.get("/me/consents", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(consentsTable)
    .where(eq(consentsTable.userId, req.user!.id))
    .orderBy(desc(consentsTable.acceptedAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      documentSlug: r.documentSlug,
      documentVersion: r.documentVersion,
      acceptedAt: r.acceptedAt,
    })),
  );
});

export default router;
