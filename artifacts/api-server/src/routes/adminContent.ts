import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  db,
  cmsPagesTable,
  cmsBlocksTable,
  blogPostsTable,
  faqItemsTable,
  testimonialsTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission } from "../lib/permissions";
import { audit } from "../lib/audit";
import { sanitizeHtml } from "./cmsContent";

const router: IRouter = Router();

const Locale = z.enum(["en", "ar"]);
const LocaleQuery = z.object({ locale: Locale.default("en") });

// CMS Pages — `status` is canonical; legacy `isPublished` is derived.
const ContentStatus = z.enum(["draft", "published", "archived"]);

const CmsPageBody = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  locale: Locale,
  title: z.string().trim().min(1).max(300),
  body: z.string().max(100_000).default(""),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().optional(),
  status: ContentStatus.optional(),
});

function deriveStatusFlags(input: { status?: "draft" | "published" | "archived"; isPublished?: boolean }): {
  status: "draft" | "published" | "archived";
  isPublished: boolean;
} {
  if (input.status) {
    return { status: input.status, isPublished: input.status === "published" };
  }
  if (input.isPublished === true) return { status: "published", isPublished: true };
  return { status: "draft", isPublished: false };
}

router.get(
  "/admin/cms/pages",
  requireAuth,
  requirePermission("cms", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(cmsPagesTable).orderBy(desc(cmsPagesTable.updatedAt));
    res.json(rows);
  },
);

router.post(
  "/admin/cms/pages",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = CmsPageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [row] = await db
        .insert(cmsPagesTable)
        .values({
          slug: parsed.data.slug,
          locale: parsed.data.locale,
          title: parsed.data.title,
          body: sanitizeHtml(parsed.data.body),
          seoTitle: parsed.data.seoTitle ?? null,
          seoDescription: parsed.data.seoDescription ?? null,
          ...(() => {
            const f = deriveStatusFlags(parsed.data);
            return { status: f.status, isPublished: f.isPublished, publishedAt: f.isPublished ? new Date() : null };
          })(),
          updatedById: req.user!.id,
        })
        .returning();
      await audit(req, "cms.page_create", "cms_page", row!.id, {}, null, row);
      res.status(201).json(row);
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        res.status(409).json({ error: "slug+locale already exists" });
        return;
      }
      throw e;
    }
  },
);

router.patch(
  "/admin/cms/pages/:id",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = CmsPageBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(cmsPagesTable).where(eq(cmsPagesTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date(), updatedById: req.user!.id };
    for (const k of ["slug", "locale", "title", "body", "seoTitle", "seoDescription"] as const) {
      if (parsed.data[k] !== undefined) {
        patch[k] = k === "body" ? sanitizeHtml(parsed.data[k] as string) : parsed.data[k];
      }
    }
    if (parsed.data.status !== undefined || parsed.data.isPublished !== undefined) {
      const f = deriveStatusFlags(parsed.data);
      patch["status"] = f.status;
      patch["isPublished"] = f.isPublished;
      if (f.isPublished && !before.publishedAt) patch["publishedAt"] = new Date();
    }
    let after;
    try {
      [after] = await db
        .update(cmsPagesTable)
        .set(patch)
        .where(eq(cmsPagesTable.id, id))
        .returning();
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        res.status(409).json({ error: "duplicate (slug, locale)" });
        return;
      }
      throw e;
    }
    await audit(req, "cms.page_update", "cms_page", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/cms/pages/:id",
  requireAuth,
  requirePermission("cms", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(cmsPagesTable).where(eq(cmsPagesTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(cmsPagesTable).where(eq(cmsPagesTable.id, id));
    await audit(req, "cms.page_delete", "cms_page", id, {}, before, null);
    res.json({ id, deleted: true });
  },
);

// Public read
router.get("/cms/pages/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "invalid slug" });
    return;
  }
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(cmsPagesTable)
    .where(
      and(
        eq(cmsPagesTable.slug, slug),
        eq(cmsPagesTable.locale, parsed.data.locale),
        eq(cmsPagesTable.isPublished, true),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(row);
});

// ───────────────── CMS Blocks ─────────────────

const CmsBlockBody = z.object({
  key: z.string().trim().min(1).max(120),
  locale: Locale,
  title: z.string().max(300).nullable().optional(),
  body: z.string().max(20_000).default(""),
});

router.get(
  "/admin/cms/blocks",
  requireAuth,
  requirePermission("cms", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(cmsBlocksTable).orderBy(cmsBlocksTable.key);
    res.json(rows);
  },
);

router.put(
  "/admin/cms/blocks",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = CmsBlockBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(cmsBlocksTable)
      .where(and(eq(cmsBlocksTable.key, parsed.data.key), eq(cmsBlocksTable.locale, parsed.data.locale)));
    let after;
    if (before) {
      [after] = await db
        .update(cmsBlocksTable)
        .set({
          title: parsed.data.title ?? null,
          body: sanitizeHtml(parsed.data.body),
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(cmsBlocksTable.id, before.id))
        .returning();
    } else {
      [after] = await db
        .insert(cmsBlocksTable)
        .values({
          key: parsed.data.key,
          locale: parsed.data.locale,
          title: parsed.data.title ?? null,
          body: sanitizeHtml(parsed.data.body),
          updatedById: req.user!.id,
        })
        .returning();
    }
    await audit(req, before ? "cms.block_update" : "cms.block_create", "cms_block", after!.id, {}, before ?? null, after);
    res.json(after);
  },
);

router.get("/cms/blocks/:key", async (req, res): Promise<void> => {
  const key = String(req.params["key"] ?? "").trim();
  if (!key) {
    res.status(400).json({ error: "invalid key" });
    return;
  }
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(cmsBlocksTable)
    .where(and(eq(cmsBlocksTable.key, key), eq(cmsBlocksTable.locale, parsed.data.locale)));
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(row);
});

// ───────────────── Blog ─────────────────

const BlogBody = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/),
  locale: Locale,
  title: z.string().trim().min(1).max(300),
  excerpt: z.string().max(1000).default(""),
  body: z.string().max(200_000).default(""),
  coverUrl: z.string().url().nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  status: ContentStatus.optional(),
});

router.get(
  "/admin/blog",
  requireAuth,
  requirePermission("blog", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(blogPostsTable)
      .where(isNull(blogPostsTable.deletedAt))
      .orderBy(desc(blogPostsTable.updatedAt));
    res.json(rows);
  },
);

router.post(
  "/admin/blog",
  requireAuth,
  requirePermission("blog", "write"),
  async (req, res): Promise<void> => {
    const parsed = BlogBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const [row] = await db
        .insert(blogPostsTable)
        .values({
          slug: parsed.data.slug,
          locale: parsed.data.locale,
          title: parsed.data.title,
          excerpt: parsed.data.excerpt,
          body: sanitizeHtml(parsed.data.body),
          coverUrl: parsed.data.coverUrl ?? null,
          category: parsed.data.category ?? null,
          categoryId: parsed.data.categoryId ?? null,
          tags: parsed.data.tags,
          seoTitle: parsed.data.seoTitle ?? null,
          seoDescription: parsed.data.seoDescription ?? null,
          isFeatured: parsed.data.isFeatured ?? false,
          ...(() => {
            const f = deriveStatusFlags(parsed.data);
            return { status: f.status, isPublished: f.isPublished, publishedAt: f.isPublished ? new Date() : null };
          })(),
          authorId: req.user!.id,
        })
        .returning();
      await audit(req, "blog.create", "blog_post", row!.id, {}, null, row);
      res.status(201).json(row);
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        res.status(409).json({ error: "slug+locale already exists" });
        return;
      }
      throw e;
    }
  },
);

router.patch(
  "/admin/blog/:id",
  requireAuth,
  requirePermission("blog", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = BlogBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of [
      "slug",
      "locale",
      "title",
      "excerpt",
      "body",
      "coverUrl",
      "category",
      "categoryId",
      "tags",
      "seoTitle",
      "seoDescription",
      "isFeatured",
    ] as const) {
      if (parsed.data[k] !== undefined) {
        patch[k] = k === "body" || k === "excerpt"
          ? sanitizeHtml(parsed.data[k] as string)
          : parsed.data[k];
      }
    }
    if (parsed.data.status !== undefined || parsed.data.isPublished !== undefined) {
      const f = deriveStatusFlags(parsed.data);
      patch["status"] = f.status;
      patch["isPublished"] = f.isPublished;
      if (f.isPublished && !before.publishedAt) patch["publishedAt"] = new Date();
    }
    let after;
    try {
      [after] = await db
        .update(blogPostsTable)
        .set(patch)
        .where(eq(blogPostsTable.id, id))
        .returning();
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") {
        res.status(409).json({ error: "duplicate (slug, locale)" });
        return;
      }
      throw e;
    }
    await audit(req, "blog.update", "blog_post", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/blog/:id",
  requireAuth,
  requirePermission("blog", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db
      .update(blogPostsTable)
      .set({ deletedAt: new Date() })
      .where(eq(blogPostsTable.id, id));
    await audit(req, "blog.delete", "blog_post", id, { soft: true }, before, null);
    res.json({ id, deleted: true });
  },
);

router.get("/blog", async (req, res): Promise<void> => {
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(blogPostsTable)
    .where(and(
      eq(blogPostsTable.locale, parsed.data.locale),
      eq(blogPostsTable.isPublished, true),
      isNull(blogPostsTable.deletedAt),
    ))
    .orderBy(desc(blogPostsTable.publishedAt));
  res.json(rows);
});

// Per-post public endpoint; reserved sub-paths defer via next().
const RESERVED_BLOG_SLUGS = new Set(["categories", "tags"]);
router.get("/blog/:slug", async (req, res, next): Promise<void> => {
  const slug = String(req.params["slug"] ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "invalid slug" });
    return;
  }
  if (RESERVED_BLOG_SLUGS.has(slug)) {
    next();
    return;
  }
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(blogPostsTable)
    .where(and(
      eq(blogPostsTable.slug, slug),
      eq(blogPostsTable.locale, parsed.data.locale),
      eq(blogPostsTable.isPublished, true),
      isNull(blogPostsTable.deletedAt),
    ));
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(row);
});

// ───────────────── FAQ ─────────────────

const FaqBody = z.object({
  locale: Locale,
  category: z.string().trim().min(1).max(60).default("general"),
  categoryId: z.number().int().positive().nullable().optional(),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(10_000),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

router.get(
  "/admin/faqs",
  requireAuth,
  requirePermission("faqs", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(faqItemsTable).orderBy(faqItemsTable.locale, faqItemsTable.sortOrder);
    res.json(rows);
  },
);

router.post(
  "/admin/faqs",
  requireAuth,
  requirePermission("faqs", "write"),
  async (req, res): Promise<void> => {
    const parsed = FaqBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(faqItemsTable)
      .values({ ...parsed.data, answer: sanitizeHtml(parsed.data.answer) })
      .returning();
    await audit(req, "faq.create", "faq_item", row!.id, {}, null, row);
    res.status(201).json(row);
  },
);

router.patch(
  "/admin/faqs/:id",
  requireAuth,
  requirePermission("faqs", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = FaqBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(faqItemsTable).where(eq(faqItemsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const faqPatch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.answer !== undefined) faqPatch["answer"] = sanitizeHtml(parsed.data.answer);
    const [after] = await db
      .update(faqItemsTable)
      .set(faqPatch)
      .where(eq(faqItemsTable.id, id))
      .returning();
    await audit(req, "faq.update", "faq_item", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/faqs/:id",
  requireAuth,
  requirePermission("faqs", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(faqItemsTable).where(eq(faqItemsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(faqItemsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(faqItemsTable.id, id))
      .returning();
    await audit(req, "faq.delete", "faq_item", id, { soft: true }, before, after);
    res.json({ id, deleted: true });
  },
);

router.get("/faqs", async (req, res): Promise<void> => {
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(faqItemsTable)
    .where(and(eq(faqItemsTable.locale, parsed.data.locale), eq(faqItemsTable.isActive, true)))
    .orderBy(faqItemsTable.category, faqItemsTable.sortOrder);
  res.json(rows);
});

// ───────────────── Testimonials ─────────────────

const TestimonialBody = z.object({
  locale: Locale,
  authorName: z.string().trim().min(1).max(200),
  authorTitle: z.string().max(200).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  quoteAr: z.string().max(2000).nullable().optional(),
  quoteEn: z.string().max(2000).nullable().optional(),
  body: z.string().max(2000).optional(),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().url().nullable().optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

function pickTestimonialBody(input: {
  locale: "ar" | "en";
  body?: string;
  quoteAr?: string | null;
  quoteEn?: string | null;
}): string {
  const localized = input.locale === "ar" ? input.quoteAr : input.quoteEn;
  if (typeof localized === "string" && localized.trim().length > 0) return localized;
  if (typeof input.body === "string" && input.body.trim().length > 0) return input.body;
  return input.quoteEn ?? input.quoteAr ?? "";
}

router.get(
  "/admin/testimonials",
  requireAuth,
  requirePermission("testimonials", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(testimonialsTable)
      .orderBy(testimonialsTable.locale, testimonialsTable.sortOrder);
    res.json(rows);
  },
);

router.post(
  "/admin/testimonials",
  requireAuth,
  requirePermission("testimonials", "write"),
  async (req, res): Promise<void> => {
    const parsed = TestimonialBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const resolvedBody = pickTestimonialBody(parsed.data);
    if (!resolvedBody) {
      res.status(400).json({ error: "body or quoteAr/quoteEn required" });
      return;
    }
    const [row] = await db
      .insert(testimonialsTable)
      .values({
        locale: parsed.data.locale,
        authorName: parsed.data.authorName,
        authorTitle: parsed.data.authorTitle ?? null,
        role: parsed.data.role ?? null,
        company: parsed.data.company ?? null,
        location: parsed.data.location ?? null,
        quoteAr: parsed.data.quoteAr ? sanitizeHtml(parsed.data.quoteAr) : null,
        quoteEn: parsed.data.quoteEn ? sanitizeHtml(parsed.data.quoteEn) : null,
        body: sanitizeHtml(resolvedBody),
        rating: parsed.data.rating,
        avatarUrl: parsed.data.avatarUrl ?? null,
        isFeatured: parsed.data.isFeatured,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();
    await audit(req, "testimonial.create", "testimonial", row!.id, {}, null, row);
    res.status(201).json(row);
  },
);

router.patch(
  "/admin/testimonials/:id",
  requireAuth,
  requirePermission("testimonials", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = TestimonialBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db.select().from(testimonialsTable).where(eq(testimonialsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const testPatch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.body !== undefined) testPatch["body"] = sanitizeHtml(parsed.data.body);
    if (parsed.data.quoteAr !== undefined && parsed.data.quoteAr !== null) {
      testPatch["quoteAr"] = sanitizeHtml(parsed.data.quoteAr);
    }
    if (parsed.data.quoteEn !== undefined && parsed.data.quoteEn !== null) {
      testPatch["quoteEn"] = sanitizeHtml(parsed.data.quoteEn);
    }
    const [after] = await db
      .update(testimonialsTable)
      .set(testPatch)
      .where(eq(testimonialsTable.id, id))
      .returning();
    await audit(req, "testimonial.update", "testimonial", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/testimonials/:id",
  requireAuth,
  requirePermission("testimonials", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db.select().from(testimonialsTable).where(eq(testimonialsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(testimonialsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(testimonialsTable.id, id))
      .returning();
    await audit(req, "testimonial.delete", "testimonial", id, { soft: true }, before, after);
    res.json({ id, deleted: true });
  },
);

router.get("/testimonials", async (req, res): Promise<void> => {
  const parsed = LocaleQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(testimonialsTable)
    .where(and(
      eq(testimonialsTable.locale, parsed.data.locale),
      eq(testimonialsTable.isActive, true),
    ))
    .orderBy(desc(testimonialsTable.isFeatured), testimonialsTable.sortOrder);
  res.json(rows);
});

export default router;
