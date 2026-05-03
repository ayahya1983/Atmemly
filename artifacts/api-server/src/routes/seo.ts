import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  freelancerProfilesTable,
  usersTable,
  categoriesTable,
  legalDocumentsTable,
} from "@workspace/db";
import { BRAND } from "@workspace/branding";
import { cached } from "../lib/cache";

const router: IRouter = Router();

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function publicBaseUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  const envDomain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (envDomain) return `https://${envDomain}`;
  const host = req.headers["host"];
  if (typeof host === "string") return `https://${host}`;
  return "http://localhost";
}

router.get("/sitemap.xml", async (req, res): Promise<void> => {
  const xml = await cached("seo:sitemap", 5 * 60 * 1000, async () => {
    const base = publicBaseUrl(req);
    const jobs = await db
      .select({ id: jobsTable.id, updated: jobsTable.createdAt })
      .from(jobsTable)
      .where(eq(jobsTable.status, "open"))
      .orderBy(desc(jobsTable.createdAt))
      .limit(2000);
    const freelancers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .innerJoin(
        freelancerProfilesTable,
        eq(freelancerProfilesTable.userId, usersTable.id),
      )
      .where(and(eq(usersTable.role, "freelancer"), eq(usersTable.status, "active")))
      .limit(2000);
    const docs = await db
      .select({ slug: legalDocumentsTable.slug })
      .from(legalDocumentsTable)
      .where(eq(legalDocumentsTable.isCurrent, true));

    const urls: Array<{ loc: string; lastmod?: string; changefreq?: string }> = [];
    urls.push({ loc: `${base}/`, changefreq: "daily" });
    urls.push({ loc: `${base}/jobs`, changefreq: "daily" });
    urls.push({ loc: `${base}/freelancers`, changefreq: "daily" });
    for (const j of jobs) {
      urls.push({
        loc: `${base}/jobs/${j.id}`,
        lastmod: (j.updated instanceof Date ? j.updated : new Date()).toISOString(),
        changefreq: "weekly",
      });
    }
    for (const f of freelancers) {
      urls.push({ loc: `${base}/freelancers/${f.id}`, changefreq: "weekly" });
    }
    for (const d of docs) {
      urls.push({ loc: `${base}/legal/${d.slug}`, changefreq: "monthly" });
    }
    const body = urls
      .map(
        (u) =>
          `<url><loc>${escXml(u.loc)}</loc>` +
          (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
          (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
          `</url>`,
      )
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
  });
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

router.get("/robots.txt", (req, res): void => {
  const base = publicBaseUrl(req);
  res
    .type("text/plain")
    .send(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/admin",
        "Disallow: /dashboard",
        `Sitemap: ${base}/api/sitemap.xml`,
      ].join("\n"),
    );
});

router.get("/public/jobs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job || job.status === "draft") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: job.id,
    title: job.title,
    description: job.description,
    categorySlug: job.categorySlug,
    budgetType: job.budgetType,
    budgetMin: Number(job.budgetMin),
    budgetMax: Number(job.budgetMax),
    currency: job.currency,
    skills: job.skills,
    status: job.status,
    createdAt: job.createdAt,
    seo: {
      title: `${job.title} — ${BRAND.name}`,
      description: job.description.slice(0, 160),
    },
  });
});

router.get("/public/freelancers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({ u: usersTable, p: freelancerProfilesTable })
    .from(usersTable)
    .innerJoin(
      freelancerProfilesTable,
      eq(freelancerProfilesTable.userId, usersTable.id),
    )
    .where(eq(usersTable.id, id));
  if (!row || row.u.status !== "active") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: row.u.id,
    fullName: row.u.fullName,
    avatarUrl: row.u.avatarUrl,
    headline: row.p.headline,
    bio: row.p.bio,
    skills: row.p.skills,
    hourlyRate: Number(row.p.hourlyRate),
    currency: row.p.currency,
    location: row.p.location,
    trustScore: row.p.trustScore ?? 0,
    seo: {
      title: `${row.u.fullName} — Freelancer on ${BRAND.name}`,
      description: (row.p.headline || row.p.bio).slice(0, 160),
    },
  });
});

router.get("/public/categories", async (req, res): Promise<void> => {
  const lang = req.query["lang"] === "ar" ? "ar" : "en";
  const rows = await cached(`seo:cats:${lang}`, 60 * 1000, async () => {
    const r = await db.select().from(categoriesTable);
    return r.map((c) => ({
      slug: c.slug,
      name: lang === "ar" ? c.nameAr : c.nameEn,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
    }));
  });
  res.json(rows);
});

export default router;
