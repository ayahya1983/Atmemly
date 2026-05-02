import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
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

const router: IRouter = Router();

const Locale = z.enum(["en", "ar"]);
const LocaleQuery = z.object({ locale: Locale.default("en") });

// ───────────────── CMS Pages ─────────────────

const CmsPageBody = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  locale: Locale,
  title: z.string().trim().min(1).max(300),
  body: z.string().max(100_000).default(""),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().default(false),
});

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
          body: parsed.data.body,
          seoTitle: parsed.data.seoTitle ?? null,
          seoDescription: parsed.data.seoDescription ?? null,
          isPublished: parsed.data.isPublished,
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
    for (const k of ["slug", "locale", "title", "body", "seoTitle", "seoDescription", "isPublished"] as const) {
      if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
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
          body: parsed.data.body,
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
          body: parsed.data.body,
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
  tags: z.array(z.string().max(40)).max(20).default([]),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  isPublished: z.boolean().default(false),
});

router.get(
  "/admin/blog",
  requireAuth,
  requirePermission("blog", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.updatedAt));
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
          body: parsed.data.body,
          coverUrl: parsed.data.coverUrl ?? null,
          category: parsed.data.category ?? null,
          tags: parsed.data.tags,
          seoTitle: parsed.data.seoTitle ?? null,
          seoDescription: parsed.data.seoDescription ?? null,
          isPublished: parsed.data.isPublished,
          publishedAt: parsed.data.isPublished ? new Date() : null,
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
      "tags",
      "seoTitle",
      "seoDescription",
      "isPublished",
    ] as const) {
      if (parsed.data[k] !== undefined) patch[k] = parsed.data[k];
    }
    if (parsed.data.isPublished === true && !before.publishedAt) {
      patch["publishedAt"] = new Date();
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
    await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
    await audit(req, "blog.delete", "blog_post", id, {}, before, null);
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
    .where(and(eq(blogPostsTable.locale, parsed.data.locale), eq(blogPostsTable.isPublished, true)))
    .orderBy(desc(blogPostsTable.publishedAt));
  res.json(rows);
});

// ───────────────── FAQ ─────────────────

const FaqBody = z.object({
  locale: Locale,
  category: z.string().trim().min(1).max(60).default("general"),
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
    const [row] = await db.insert(faqItemsTable).values(parsed.data).returning();
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
    const [after] = await db
      .update(faqItemsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
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
    await db.delete(faqItemsTable).where(eq(faqItemsTable.id, id));
    await audit(req, "faq.delete", "faq_item", id, {}, before, null);
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
  body: z.string().trim().min(1).max(2000),
  rating: z.number().int().min(1).max(5).default(5),
  avatarUrl: z.string().url().nullable().optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

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
    const [row] = await db
      .insert(testimonialsTable)
      .values({
        locale: parsed.data.locale,
        authorName: parsed.data.authorName,
        authorTitle: parsed.data.authorTitle ?? null,
        body: parsed.data.body,
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
    const [after] = await db
      .update(testimonialsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
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
    await db.delete(testimonialsTable).where(eq(testimonialsTable.id, id));
    await audit(req, "testimonial.delete", "testimonial", id, {}, before, null);
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
    .where(eq(testimonialsTable.locale, parsed.data.locale))
    .orderBy(desc(testimonialsTable.isFeatured), testimonialsTable.sortOrder);
  res.json(rows);
});

export default router;
