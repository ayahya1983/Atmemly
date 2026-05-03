// CMS router: homepage, nav, footer, SEO, localization, categories, media.
import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import {
  db,
  cmsHomepageTable,
  navigationItemsTable,
  footerSettingsTable,
  footerLinkGroupsTable,
  footerLinksTable,
  seoSettingsTable,
  localizationStringsTable,
  localizationSettingsTable,
  blogCategoriesTable,
  faqCategoriesTable,
  attachmentsTable,
  type HomepageData,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requirePermission, hasPermission } from "../lib/permissions";
import { audit } from "../lib/audit";
import { rateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

const Locale = z.enum(["en", "ar"]);

// Sanitize CMS rich-text via sanitize-html allowlist.
import sanitizeHtmlLib from "sanitize-html";
function sanitizeHtml(input: string): string {
  return sanitizeHtmlLib(input, {
    allowedTags: [
      "p", "br", "hr", "strong", "em", "u", "s", "code", "pre",
      "blockquote", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "table", "thead", "tbody", "tr", "td", "th",
      "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["dir", "lang"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}

// ──────────────────── HOMEPAGE (singleton) ────────────────────

const HomepageHero = z.object({
  titleAr: z.string().max(300).default(""),
  titleEn: z.string().max(300).default(""),
  subtitleAr: z.string().max(600).default(""),
  subtitleEn: z.string().max(600).default(""),
  searchPlaceholderAr: z.string().max(200).default(""),
  searchPlaceholderEn: z.string().max(200).default(""),
  imageUrl: z.string().max(500).default(""),
  ctaPrimaryLabelAr: z.string().max(100).default(""),
  ctaPrimaryLabelEn: z.string().max(100).default(""),
  ctaPrimaryHref: z.string().max(300).default(""),
  ctaSecondaryLabelAr: z.string().max(100).default(""),
  ctaSecondaryLabelEn: z.string().max(100).default(""),
  ctaSecondaryHref: z.string().max(300).default(""),
});

const HomepageSection = z.object({
  key: z.string().min(1).max(64),
  titleAr: z.string().max(300).default(""),
  titleEn: z.string().max(300).default(""),
  subtitleAr: z.string().max(600).default(""),
  subtitleEn: z.string().max(600).default(""),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

const HomepageBody = z.object({
  hero: HomepageHero,
  sections: z.array(HomepageSection).max(20),
});

async function getOrCreateHomepage(): Promise<HomepageData> {
  const [row] = await db.select().from(cmsHomepageTable).limit(1);
  if (row) return row.data;
  const empty: HomepageData = {
    hero: {
      titleAr: "",
      titleEn: "",
      subtitleAr: "",
      subtitleEn: "",
      searchPlaceholderAr: "",
      searchPlaceholderEn: "",
      imageUrl: "",
      ctaPrimaryLabelAr: "",
      ctaPrimaryLabelEn: "",
      ctaPrimaryHref: "",
      ctaSecondaryLabelAr: "",
      ctaSecondaryLabelEn: "",
      ctaSecondaryHref: "",
    },
    sections: [],
  };
  await db.insert(cmsHomepageTable).values({ data: empty });
  return empty;
}

router.get("/cms/homepage", async (_req, res): Promise<void> => {
  const data = await getOrCreateHomepage();
  res.json(data);
});

router.get(
  "/admin/cms/homepage",
  requireAuth,
  requirePermission("cms", "read"),
  async (_req, res): Promise<void> => {
    const data = await getOrCreateHomepage();
    res.json(data);
  },
);

router.put(
  "/admin/cms/homepage",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = HomepageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const before = await getOrCreateHomepage();
    const [row] = await db.select().from(cmsHomepageTable).limit(1);
    const data: HomepageData = parsed.data;
    let after;
    if (row) {
      [after] = await db
        .update(cmsHomepageTable)
        .set({ data, updatedById: req.user!.id, updatedAt: new Date() })
        .where(eq(cmsHomepageTable.id, row.id))
        .returning();
    } else {
      [after] = await db
        .insert(cmsHomepageTable)
        .values({ data, updatedById: req.user!.id })
        .returning();
    }
    await audit(req, "cms.homepage_update", "cms_homepage", after!.id, {}, before, data);
    res.json(data);
  },
);

// ──────────────────── NAVIGATION ────────────────────

// Block javascript:/data: hrefs.
const safeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) => /^(\/|#|\?|https?:\/\/|mailto:|tel:)/i.test(v),
    { message: "href must be a relative path, http(s), mailto:, or tel: URL" },
  );

const NavBody = z.object({
  location: z.enum(["HEADER", "FOOTER"]),
  parentId: z.number().int().nullable().optional(),
  labelAr: z.string().trim().min(1).max(200),
  labelEn: z.string().trim().min(1).max(200),
  href: safeHrefSchema,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

router.get("/navigation", async (req, res): Promise<void> => {
  const loc = String(req.query["location"] ?? "").toUpperCase();
  const where =
    loc === "HEADER" || loc === "FOOTER"
      ? and(eq(navigationItemsTable.location, loc), eq(navigationItemsTable.isActive, true))
      : eq(navigationItemsTable.isActive, true);
  const rows = await db
    .select()
    .from(navigationItemsTable)
    .where(where)
    .orderBy(asc(navigationItemsTable.location), asc(navigationItemsTable.sortOrder));
  res.json(rows);
});

router.get(
  "/admin/navigation",
  requireAuth,
  requirePermission("cms", "read"),
  async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(navigationItemsTable)
      .orderBy(asc(navigationItemsTable.location), asc(navigationItemsTable.sortOrder));
    res.json(rows);
  },
);

router.post(
  "/admin/navigation",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    if (!hasPermission(req.user, "settings", "write")) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const parsed = NavBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .insert(navigationItemsTable)
      .values({ ...parsed.data, parentId: parsed.data.parentId ?? null })
      .returning();
    await audit(req, "navigation.create", "navigation_item", row!.id, {}, null, row);
    res.status(201).json(row);
  },
);

router.patch(
  "/admin/navigation/:id",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    if (!hasPermission(req.user, "settings", "write")) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = NavBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(navigationItemsTable)
      .where(eq(navigationItemsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(navigationItemsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(navigationItemsTable.id, id))
      .returning();
    await audit(req, "navigation.update", "navigation_item", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/navigation/:id",
  requireAuth,
  requirePermission("cms", "delete"),
  async (req, res): Promise<void> => {
    if (!hasPermission(req.user, "settings", "write")) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db
      .select()
      .from(navigationItemsTable)
      .where(eq(navigationItemsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(navigationItemsTable).where(eq(navigationItemsTable.id, id));
    await audit(req, "navigation.delete", "navigation_item", id, {}, before, null);
    res.json({ id, deleted: true });
  },
);

// ──────────────────── FOOTER ────────────────────

const FooterSettingsBody = z.object({
  descriptionAr: z.string().max(2000).default(""),
  descriptionEn: z.string().max(2000).default(""),
  contactEmail: z.string().max(200).default(""),
  contactPhone: z.string().max(60).default(""),
  whatsapp: z.string().max(60).default(""),
  addressAr: z.string().max(500).default(""),
  addressEn: z.string().max(500).default(""),
  copyrightAr: z.string().max(500).default(""),
  copyrightEn: z.string().max(500).default(""),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().min(1).max(40),
        url: z.string().url(),
      }),
    )
    .max(20)
    .default([]),
});

const FooterGroupBody = z.object({
  titleAr: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

const FooterLinkBody = z.object({
  groupId: z.number().int(),
  labelAr: z.string().trim().min(1).max(200),
  labelEn: z.string().trim().min(1).max(200),
  href: safeHrefSchema,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

async function loadFooterPayload() {
  const [settings] = await db.select().from(footerSettingsTable).limit(1);
  const groups = await db
    .select()
    .from(footerLinkGroupsTable)
    .orderBy(asc(footerLinkGroupsTable.sortOrder));
  const links = await db
    .select()
    .from(footerLinksTable)
    .orderBy(asc(footerLinksTable.groupId), asc(footerLinksTable.sortOrder));
  return { settings: settings ?? null, groups, links };
}

router.get("/footer", async (_req, res): Promise<void> => {
  const payload = await loadFooterPayload();
  res.json({
    settings: payload.settings,
    groups: payload.groups
      .filter((g) => g.isActive)
      .map((g) => ({
        ...g,
        links: payload.links.filter((l) => l.groupId === g.id && l.isActive),
      })),
  });
});

router.get(
  "/admin/footer",
  requireAuth,
  requirePermission("cms", "read"),
  async (_req, res): Promise<void> => {
    const payload = await loadFooterPayload();
    res.json({
      settings: payload.settings,
      groups: payload.groups.map((g) => ({
        ...g,
        links: payload.links.filter((l) => l.groupId === g.id),
      })),
    });
  },
);

router.put(
  "/admin/footer/settings",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = FooterSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db.select().from(footerSettingsTable).limit(1);
    let after;
    if (existing) {
      [after] = await db
        .update(footerSettingsTable)
        .set({ ...parsed.data, updatedById: req.user!.id, updatedAt: new Date() })
        .where(eq(footerSettingsTable.id, existing.id))
        .returning();
    } else {
      [after] = await db
        .insert(footerSettingsTable)
        .values({ ...parsed.data, updatedById: req.user!.id })
        .returning();
    }
    await audit(req, "footer.settings_update", "footer_settings", after!.id, {}, existing ?? null, after);
    res.json(after);
  },
);

router.post(
  "/admin/footer/groups",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = FooterGroupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db.insert(footerLinkGroupsTable).values(parsed.data).returning();
    await audit(req, "footer.group_create", "footer_link_group", row!.id, {}, null, row);
    res.status(201).json(row);
  },
);

router.patch(
  "/admin/footer/groups/:id",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = FooterGroupBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(footerLinkGroupsTable)
      .where(eq(footerLinkGroupsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(footerLinkGroupsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(footerLinkGroupsTable.id, id))
      .returning();
    await audit(req, "footer.group_update", "footer_link_group", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/footer/groups/:id",
  requireAuth,
  requirePermission("cms", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db
      .select()
      .from(footerLinkGroupsTable)
      .where(eq(footerLinkGroupsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(footerLinksTable).where(eq(footerLinksTable.groupId, id));
    await db.delete(footerLinkGroupsTable).where(eq(footerLinkGroupsTable.id, id));
    await audit(req, "footer.group_delete", "footer_link_group", id, {}, before, null);
    res.json({ id, deleted: true });
  },
);

router.post(
  "/admin/footer/links",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const parsed = FooterLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db.insert(footerLinksTable).values(parsed.data).returning();
    await audit(req, "footer.link_create", "footer_link", row!.id, {}, null, row);
    res.status(201).json(row);
  },
);

router.patch(
  "/admin/footer/links/:id",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = FooterLinkBody.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(footerLinksTable)
      .where(eq(footerLinksTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(footerLinksTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(footerLinksTable.id, id))
      .returning();
    await audit(req, "footer.link_update", "footer_link", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/footer/links/:id",
  requireAuth,
  requirePermission("cms", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db
      .select()
      .from(footerLinksTable)
      .where(eq(footerLinksTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(footerLinksTable).where(eq(footerLinksTable.id, id));
    await audit(req, "footer.link_delete", "footer_link", id, {}, before, null);
    res.json({ id, deleted: true });
  },
);

// ──────────────────── GLOBAL SEO (singleton) ────────────────────

const SeoBody = z.object({
  siteTitleAr: z.string().max(300).default(""),
  siteTitleEn: z.string().max(300).default(""),
  siteDescriptionAr: z.string().max(1000).default(""),
  siteDescriptionEn: z.string().max(1000).default(""),
  ogImageUrl: z.string().max(500).nullable().optional(),
  twitterHandle: z.string().max(100).nullable().optional(),
  defaultLocale: z.enum(["ar", "en"]).default("ar"),
});

router.get("/seo", async (_req, res): Promise<void> => {
  const [row] = await db.select().from(seoSettingsTable).limit(1);
  res.json(row ?? null);
});

router.get(
  "/admin/seo",
  requireAuth,
  requirePermission("seo", "read"),
  async (_req, res): Promise<void> => {
    const [row] = await db.select().from(seoSettingsTable).limit(1);
    res.json(row ?? null);
  },
);

router.put(
  "/admin/seo",
  requireAuth,
  requirePermission("seo", "write"),
  async (req, res): Promise<void> => {
    if (!hasPermission(req.user, "settings", "write")) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const parsed = SeoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db.select().from(seoSettingsTable).limit(1);
    let after;
    if (existing) {
      [after] = await db
        .update(seoSettingsTable)
        .set({
          ...parsed.data,
          ogImageUrl: parsed.data.ogImageUrl ?? null,
          twitterHandle: parsed.data.twitterHandle ?? null,
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(seoSettingsTable.id, existing.id))
        .returning();
    } else {
      [after] = await db
        .insert(seoSettingsTable)
        .values({
          ...parsed.data,
          ogImageUrl: parsed.data.ogImageUrl ?? null,
          twitterHandle: parsed.data.twitterHandle ?? null,
          updatedById: req.user!.id,
        })
        .returning();
    }
    await audit(req, "seo.update", "seo_settings", after!.id, {}, existing ?? null, after);
    res.json(after);
  },
);

// ──────────────────── LOCALIZATION ────────────────────

const LocalizationBody = z.object({
  key: z.string().trim().min(1).max(200),
  locale: Locale,
  namespace: z.string().trim().min(1).max(60).default("common"),
  value: z.string().max(5000).default(""),
  isMissing: z.boolean().default(false),
});

// Localization settings (singleton)
const LocalizationSettingsBody = z.object({
  defaultLocale: z.string().min(2).max(10),
  enabledLocales: z.array(z.string().min(2).max(10)).min(1),
  rtlLocales: z.array(z.string().min(2).max(10)),
  fallbackLocale: z.string().min(2).max(10),
  isRtlByDefault: z.boolean(),
});

async function ensureLocalizationSettings() {
  const [row] = await db.select().from(localizationSettingsTable).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(localizationSettingsTable)
    .values({ id: 1 })
    .returning();
  return created!;
}

router.get("/localization/settings", async (_req, res): Promise<void> => {
  const row = await ensureLocalizationSettings();
  res.json(row);
});

router.put(
  "/admin/localization/settings",
  requireAuth,
  requirePermission("localization", "write"),
  async (req, res): Promise<void> => {
    const parsed = LocalizationSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const before = await ensureLocalizationSettings();
    const [after] = await db
      .update(localizationSettingsTable)
      .set({ ...parsed.data, updatedById: req.user!.id, updatedAt: new Date() })
      .where(eq(localizationSettingsTable.id, before.id))
      .returning();
    await audit(req, "localization.settings.update", "localization_settings", after!.id, {}, before, after);
    res.json(after);
  },
);

// Endpoint for the marketplace runtime to report missing translation keys
// so admins can fill them in via the existing localization editor
// (/admin/localization?missing=1). Intentionally unauthenticated because
// it is invoked from the public, unauthenticated marketplace; abuse is
// mitigated by:
//   • strict zod payload validation (shape, sizes, locale enum)
//   • per-IP rate limiting (60 requests / minute)
//   • idempotent insert via onConflictDoNothing on (key, locale) so spam
//     cannot create duplicate or pollute existing translated rows.
const ReportMissingBody = z.object({
  keys: z
    .array(
      z.object({
        key: z
          .string()
          .trim()
          .min(1)
          .max(200)
          // Allow only alphanum, dot, underscore, dash, colon — blocks weird
          // payloads while supporting our `namespace.sub.key` convention.
          .regex(/^[A-Za-z0-9._:-]+$/),
        locale: Locale,
        namespace: z
          .string()
          .trim()
          .min(1)
          .max(60)
          .regex(/^[A-Za-z0-9._-]+$/)
          .default("common"),
      }),
    )
    .min(1)
    .max(50),
});

const reportMissingLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: "loc-missing",
  message: "Too many missing-key reports; slow down.",
});

router.post(
  "/admin/localization/missing",
  reportMissingLimiter,
  async (req, res): Promise<void> => {
    const parsed = ReportMissingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = parsed.data.keys.map((item) => ({
      key: item.key,
      locale: item.locale,
      namespace: item.namespace,
      value: "",
      isMissing: true,
    }));
    // onConflictDoNothing on the (key, locale) unique index ensures we
    // never overwrite an existing translation (missing or filled-in).
    const inserted = await db
      .insert(localizationStringsTable)
      .values(rows)
      .onConflictDoNothing({
        target: [localizationStringsTable.key, localizationStringsTable.locale],
      })
      .returning({ id: localizationStringsTable.id });
    res.json({ recorded: inserted.length });
  },
);

router.get("/localization/:locale", async (req, res): Promise<void> => {
  const loc = req.params["locale"];
  if (loc !== "ar" && loc !== "en") {
    res.status(400).json({ error: "invalid locale" });
    return;
  }
  const rows = await db
    .select()
    .from(localizationStringsTable)
    .where(eq(localizationStringsTable.locale, loc));
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (!r.isMissing) map[r.key] = r.value;
  }
  res.json(map);
});

router.get(
  "/admin/localization",
  requireAuth,
  requirePermission("localization", "read"),
  async (req, res): Promise<void> => {
    const missing = req.query["missing"] === "1";
    const baseQuery = db
      .select()
      .from(localizationStringsTable)
      .$dynamic();
    const filtered = missing
      ? baseQuery.where(eq(localizationStringsTable.isMissing, true))
      : baseQuery;
    const rows = await filtered.orderBy(
      asc(localizationStringsTable.namespace),
      asc(localizationStringsTable.key),
    );
    res.json(rows);
  },
);

router.put(
  "/admin/localization",
  requireAuth,
  requirePermission("localization", "write"),
  async (req, res): Promise<void> => {
    const parsed = LocalizationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(localizationStringsTable)
      .where(
        and(
          eq(localizationStringsTable.key, parsed.data.key),
          eq(localizationStringsTable.locale, parsed.data.locale),
        ),
      );
    let after;
    if (existing) {
      [after] = await db
        .update(localizationStringsTable)
        .set({
          namespace: parsed.data.namespace,
          value: parsed.data.value,
          isMissing: parsed.data.isMissing,
          updatedById: req.user!.id,
          updatedAt: new Date(),
        })
        .where(eq(localizationStringsTable.id, existing.id))
        .returning();
    } else {
      [after] = await db
        .insert(localizationStringsTable)
        .values({ ...parsed.data, updatedById: req.user!.id })
        .returning();
    }
    await audit(
      req,
      existing ? "localization.update" : "localization.create",
      "localization_string",
      after!.id,
      {},
      existing ?? null,
      after,
    );
    res.json(after);
  },
);

router.delete(
  "/admin/localization/:id",
  requireAuth,
  requirePermission("localization", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db
      .select()
      .from(localizationStringsTable)
      .where(eq(localizationStringsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db.delete(localizationStringsTable).where(eq(localizationStringsTable.id, id));
    await audit(req, "localization.delete", "localization_string", id, {}, before, null);
    res.json({ id, deleted: true });
  },
);

// ──────────────────── BLOG / FAQ CATEGORIES ────────────────────

const CategoryBody = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  nameAr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  seoTitleAr: z.string().max(300).nullable().optional(),
  seoTitleEn: z.string().max(300).nullable().optional(),
  seoDescriptionAr: z.string().max(500).nullable().optional(),
  seoDescriptionEn: z.string().max(500).nullable().optional(),
  seoImageUrl: z.string().max(500).nullable().optional(),
});

function makeCategoryRoutes(
  table: typeof blogCategoriesTable | typeof faqCategoriesTable,
  basePath: string,
  permResource: "blog" | "faqs",
  entityType: string,
) {
  router.get(`/${basePath}`, async (_req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(table)
      .where(eq(table.isActive, true))
      .orderBy(asc(table.sortOrder));
    res.json(rows);
  });
  router.get(
    `/admin/${basePath}`,
    requireAuth,
    requirePermission(permResource, "read"),
    async (_req, res): Promise<void> => {
      const rows = await db.select().from(table).orderBy(asc(table.sortOrder));
      res.json(rows);
    },
  );
  router.post(
    `/admin/${basePath}`,
    requireAuth,
    requirePermission(permResource, "write"),
    async (req, res): Promise<void> => {
      const parsed = CategoryBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      try {
        const [row] = await db.insert(table).values(parsed.data).returning();
        await audit(req, `${entityType}.create`, entityType, row!.id, {}, null, row);
        res.status(201).json(row);
      } catch (e) {
        const code =
          (e as { code?: string; cause?: { code?: string } }).code ??
          (e as { cause?: { code?: string } }).cause?.code;
        if (code === "23505") {
          res.status(409).json({ error: "slug already exists" });
          return;
        }
        throw e;
      }
    },
  );
  router.patch(
    `/admin/${basePath}/:id`,
    requireAuth,
    requirePermission(permResource, "write"),
    async (req, res): Promise<void> => {
      const id = Number(req.params["id"]);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid id" });
        return;
      }
      const parsed = CategoryBody.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const [before] = await db.select().from(table).where(eq(table.id, id));
      if (!before) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const [after] = await db
        .update(table)
        .set(parsed.data)
        .where(eq(table.id, id))
        .returning();
      await audit(req, `${entityType}.update`, entityType, id, {}, before, after);
      res.json(after);
    },
  );
  router.delete(
    `/admin/${basePath}/:id`,
    requireAuth,
    requirePermission(permResource, "delete"),
    async (req, res): Promise<void> => {
      const id = Number(req.params["id"]);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "invalid id" });
        return;
      }
      const [before] = await db.select().from(table).where(eq(table.id, id));
      if (!before) {
        res.status(404).json({ error: "not found" });
        return;
      }
      await db.delete(table).where(eq(table.id, id));
      await audit(req, `${entityType}.delete`, entityType, id, {}, before, null);
      res.json({ id, deleted: true });
    },
  );
}

makeCategoryRoutes(blogCategoriesTable, "blog/categories", "blog", "blog_category");
makeCategoryRoutes(faqCategoriesTable, "faq/categories", "faqs", "faq_category");

// ──────────────────── MEDIA LIBRARY ────────────────────

const MediaPatchBody = z.object({
  altAr: z.string().max(500).nullable().optional(),
  altEn: z.string().max(500).nullable().optional(),
});

router.get(
  "/admin/media",
  requireAuth,
  requirePermission("cms", "read"),
  async (req, res): Promise<void> => {
    const limit = Math.min(200, Math.max(1, Number(req.query["limit"] ?? 50)));
    const offset = Math.max(0, Number(req.query["offset"] ?? 0));
    const search = String(req.query["q"] ?? "").trim();
    const conditions = [isNull(attachmentsTable.deletedAt)];
    if (search) {
      conditions.push(sql`lower(${attachmentsTable.originalName}) LIKE ${"%" + search.toLowerCase() + "%"}`);
    }
    const where = conditions.length === 1 ? conditions[0] : and(...conditions);
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attachmentsTable)
      .where(where);
    const items = await db
      .select()
      .from(attachmentsTable)
      .where(where)
      .orderBy(desc(attachmentsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json({ items, total, limit, offset });
  },
);

router.patch(
  "/admin/media/:id",
  requireAuth,
  requirePermission("cms", "write"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const parsed = MediaPatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [before] = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const [after] = await db
      .update(attachmentsTable)
      .set({
        altAr: parsed.data.altAr ?? null,
        altEn: parsed.data.altEn ?? null,
      })
      .where(eq(attachmentsTable.id, id))
      .returning();
    await audit(req, "media.update", "attachment", id, {}, before, after);
    res.json(after);
  },
);

router.delete(
  "/admin/media/:id",
  requireAuth,
  requirePermission("cms", "delete"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid id" });
      return;
    }
    const [before] = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.id, id));
    if (!before) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const url = before.url;
    const like = "%" + url + "%";
    const usageCount = await db.execute<{ count: number }>(sql`
      SELECT (
        (SELECT COUNT(*) FROM cms_homepage WHERE data::text LIKE ${like}) +
        (SELECT COUNT(*) FROM cms_pages WHERE body LIKE ${like}) +
        (SELECT COUNT(*) FROM blog_posts WHERE cover_url = ${url} OR body LIKE ${like}) +
        (SELECT COUNT(*) FROM seo_settings WHERE og_image_url = ${url}) +
        (SELECT COUNT(*) FROM footer_settings WHERE social_links::text LIKE ${like}) +
        (SELECT COUNT(*) FROM footer_links WHERE href = ${url}) +
        (SELECT COUNT(*) FROM navigation_items WHERE href = ${url}) +
        (SELECT COUNT(*) FROM testimonials WHERE avatar_url = ${url})
      )::int AS count
    `);
    const inUse =
      Array.isArray(usageCount.rows) && usageCount.rows[0]
        ? Number((usageCount.rows[0] as { count?: number }).count ?? 0) > 0
        : false;
    if (inUse && req.query["force"] !== "1") {
      res.status(409).json({ error: "in_use", message: "Asset is referenced; pass ?force=1 to override" });
      return;
    }
    await db
      .update(attachmentsTable)
      .set({ deletedAt: new Date() })
      .where(eq(attachmentsTable.id, id));
    await audit(req, "media.delete", "attachment", id, { soft: true }, before, null);
    res.json({ id, deleted: true });
  },
);

export { sanitizeHtml };
export default router;
