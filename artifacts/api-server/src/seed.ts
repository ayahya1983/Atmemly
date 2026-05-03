import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { BRAND } from "@workspace/branding";
import {
  db,
  pool,
  usersTable,
  freelancerProfilesTable,
  clientProfilesTable,
  categoriesTable,
  skillsTable,
  jobsTable,
  proposalsTable,
  reviewsTable,
  paymentsTable,
  notificationsTable,
  legalDocumentsTable,
  platformSettingsTable,
  currenciesTable,
  fxRatesTable,
  subscriptionPlansTable,
  paymentGatewaysTable,
  cmsPagesTable,
  cmsBlocksTable,
  blogPostsTable,
  faqItemsTable,
  testimonialsTable,
  bannedWordsTable,
  cmsHomepageTable,
  navigationItemsTable,
  footerSettingsTable,
  footerLinkGroupsTable,
  footerLinksTable,
  seoSettingsTable,
  localizationStringsTable,
  blogCategoriesTable,
  faqCategoriesTable,
} from "@workspace/db";

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

// Demo-user avatar map. Each demo email is bound to a same-origin SVG
// avatar shipped under `artifacts/marketplace/public/assets/avatars/`.
// These replace the previously-used external dicebear URLs which
// silently failed in production and made the homepage show only
// single-letter initials.
const DEMO_AVATARS: Record<string, string> = {
  "admin@atmemly.com": "/assets/avatars/avatar-08.svg",
  "noor@atmemly.com": "/assets/avatars/avatar-06.svg",
  "saeed@atmemly.com": "/assets/avatars/avatar-07.svg",
  "layla@atmemly.com": "/assets/avatars/avatar-01.svg",
  "omar@atmemly.com": "/assets/avatars/avatar-02.svg",
  "huda@atmemly.com": "/assets/avatars/avatar-03.svg",
  "khalid@atmemly.com": "/assets/avatars/avatar-04.svg",
  "amal@atmemly.com": "/assets/avatars/avatar-05.svg",
};

function avatarFor(email: string): string | null {
  return DEMO_AVATARS[email] ?? null;
}

function assertNotProduction() {
  const nodeEnv = process.env["NODE_ENV"];
  const allow = process.env["ALLOW_PROD_SEED"];
  if (nodeEnv === "production" && allow !== "1") {
    throw new Error(
      "Refusing to run seed against NODE_ENV=production. " +
        "The seed script creates demo accounts (admin@atmemly.com / admin1234, etc.) " +
        "with publicly documented passwords — see the 'Default seeded logins' and " +
        "'Deployment notes' sections of README.md. " +
        "If you really intend to seed a production database, re-run with ALLOW_PROD_SEED=1.",
    );
  }
}

type UserInsert = typeof usersTable.$inferInsert;
type UserRow = typeof usersTable.$inferSelect;

async function upsertUser(values: UserInsert): Promise<UserRow> {
  // Create-if-missing only — never overwrite an existing demo user's
  // password, role, or profile fields.
  const inserted = await db
    .insert(usersTable)
    .values(values)
    .onConflictDoNothing({ target: usersTable.email })
    .returning();
  if (inserted[0]) return inserted[0];
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, values.email));
  return existing!;
}

async function main() {
  assertNotProduction();
  console.log("Seeding…");

  // ---------- Categories (lookup, idempotent on slug) ----------
  const categories = [
    { slug: "design", nameEn: "Brand & Identity Design", nameAr: "تصميم الهوية والعلامات" },
    { slug: "development", nameEn: "Web & Mobile Development", nameAr: "تطوير الويب والتطبيقات" },
    { slug: "writing", nameEn: "Arabic Copywriting", nameAr: "الكتابة باللغة العربية" },
    { slug: "translation", nameEn: "Translation EN ⇄ AR", nameAr: "الترجمة بين العربية والإنجليزية" },
    { slug: "marketing", nameEn: "Marketing & SEO", nameAr: "التسويق وتحسين محركات البحث" },
    { slug: "video", nameEn: "Video & Motion", nameAr: "الفيديو والموشن جرافيك" },
    { slug: "photography", nameEn: "Photography", nameAr: "التصوير الفوتوغرافي" },
    { slug: "consulting", nameEn: "Business Consulting", nameAr: "استشارات الأعمال" },
    { slug: "data", nameEn: "Data & Analytics", nameAr: "البيانات والتحليلات" },
    { slug: "legal-finance", nameEn: "Legal & Finance", nameAr: "الخدمات القانونية والمالية" },
  ];
  await db.insert(categoriesTable).values(categories).onConflictDoNothing({ target: categoriesTable.slug });

  // ---------- Skills (lookup, idempotent on name) ----------
  const skills = [
    "React", "Next.js", "TypeScript", "Node.js", "Express", "PostgreSQL",
    "UI/UX", "Figma", "Branding", "Logo Design", "Illustration",
    "SEO", "Google Ads", "Meta Ads", "Content Strategy",
    "Arabic Copywriting", "English Copywriting", "Translation EN-AR",
    "Video Editing", "Motion Graphics", "After Effects",
    "Shopify", "WordPress", "iOS", "Android", "Flutter",
    "Data Analysis", "Power BI", "Tableau",
    "Project Management", "Virtual Assistance",
  ];
  await db
    .insert(skillsTable)
    .values(skills.map((name) => ({ name })))
    .onConflictDoNothing({ target: skillsTable.name });

  // ---------- Demo users (create-if-missing only) ----------
  const adminPwd = await hash("admin1234");
  const clientPwd = await hash("client1234");
  const freelancerPwd = await hash("freelancer1234");

  const admin = await upsertUser({
    email: "admin@atmemly.com",
    passwordHash: adminPwd,
    fullName: `${BRAND.name} Admin`,
    role: "admin",
    avatarUrl: avatarFor("admin@atmemly.com"),
  });

  const clientsData = [
    {
      email: "noor@atmemly.com",
      fullName: "Noor Al Hashimi",
      companyName: "Noor Creative Agency",
      overview: "A Dubai-based creative agency working with regional brands across the Gulf.",
      location: "Dubai, UAE",
    },
    {
      email: "saeed@atmemly.com",
      fullName: "Saeed Al Maktoum",
      companyName: "GulfTech Studios",
      overview: "Building modern digital products for SMBs across the GCC.",
      location: "Abu Dhabi, UAE",
    },
  ];
  const clients: UserRow[] = [];
  for (const c of clientsData) {
    const u = await upsertUser({
      email: c.email,
      passwordHash: clientPwd,
      fullName: c.fullName,
      role: "client",
      avatarUrl: avatarFor(c.email),
    });
    await db
      .insert(clientProfilesTable)
      .values({
        userId: u.id,
        companyName: c.companyName,
        overview: c.overview,
        location: c.location,
        logoUrl: null,
      })
      .onConflictDoNothing({ target: clientProfilesTable.userId });
    clients.push(u);
  }

  const freelancersData = [
    {
      email: "layla@atmemly.com",
      fullName: "Layla Bin Saeed",
      headline: "Senior Brand & Identity Designer",
      bio: "10+ years crafting identities for regional and international brands. Based in Dubai, fluent in Arabic and English.",
      hourlyRate: 220,
      skills: ["Branding", "Logo Design", "Figma", "UI/UX"],
      location: "Dubai, UAE",
    },
    {
      email: "omar@atmemly.com",
      fullName: "Omar Al Saadi",
      headline: "Full-stack Developer (React + Node)",
      bio: "Building production web apps for fintech and e-commerce clients across the GCC.",
      hourlyRate: 280,
      skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL"],
      location: "Riyadh, KSA",
    },
    {
      email: "huda@atmemly.com",
      fullName: "Huda Mansour",
      headline: "Bilingual Copywriter & Content Strategist",
      bio: "I write punchy bilingual copy for brands that want to win Arabic-speaking audiences without losing their English voice.",
      hourlyRate: 180,
      skills: ["Arabic Copywriting", "English Copywriting", "Content Strategy", "Translation EN-AR"],
      location: "Amman, Jordan",
    },
    {
      email: "khalid@atmemly.com",
      fullName: "Khalid Al Farsi",
      headline: "Performance Marketer (Google + Meta)",
      bio: "I run profitable paid campaigns for D2C brands. AED 50M+ ad spend managed across the Gulf.",
      hourlyRate: 240,
      skills: ["Google Ads", "Meta Ads", "SEO", "Content Strategy"],
      location: "Doha, Qatar",
    },
    {
      email: "amal@atmemly.com",
      fullName: "Amal Karim",
      headline: "Motion Designer & Video Editor",
      bio: "I make broadcast-quality short videos and motion graphics for ads, social and product launches.",
      hourlyRate: 200,
      skills: ["Video Editing", "Motion Graphics", "After Effects"],
      location: "Cairo, Egypt",
    },
  ];

  const freelancers: Array<{ id: number; fullName: string }> = [];
  for (const f of freelancersData) {
    const u = await upsertUser({
      email: f.email,
      passwordHash: freelancerPwd,
      fullName: f.fullName,
      role: "freelancer",
      avatarUrl: avatarFor(f.email),
    });
    await db
      .insert(freelancerProfilesTable)
      .values({
        userId: u.id,
        headline: f.headline,
        bio: f.bio,
        hourlyRate: String(f.hourlyRate),
        currency: "AED",
        location: f.location,
        skills: f.skills,
        portfolio: [
          { title: "Featured project", url: "https://example.com/p1", description: "A flagship engagement showcasing my craft." },
          { title: "Recent launch", url: "https://example.com/p2", description: "Recently shipped work for a regional brand." },
        ],
      })
      .onConflictDoNothing({ target: freelancerProfilesTable.userId });
    freelancers.push({ id: u.id, fullName: u.fullName });
  }

  // ---------- Refresh demo avatars on every run ----------
  // upsertUser is create-if-missing only, so existing demo accounts
  // keep their old avatar_url (previously external dicebear URLs that
  // failed to load). Force the demo set onto same-origin SVGs so the
  // homepage never falls back to single-letter initials.
  for (const [email, url] of Object.entries(DEMO_AVATARS)) {
    await db
      .update(usersTable)
      .set({ avatarUrl: url })
      .where(eq(usersTable.email, email));
  }

  // Sweep any remaining external dicebear avatars (legacy seed
  // iterations created accounts under @khidma.ae / @nooragency.ae /
  // etc. that survive across re-seeds). Map them deterministically to
  // one of the 8 same-origin SVG avatars by user id so no card on the
  // homepage ever depends on the external CDN.
  await db.execute(sql`
    UPDATE users
    SET avatar_url = '/assets/avatars/avatar-0' || ((id % 8) + 1)::text || '.svg'
    WHERE avatar_url LIKE '%dicebear%'
  `);

  // ---------- Cleanup: legacy QA "Phase Six Tester" rows ----------
  // Earlier QA seeds (see scripts/smoke-phase6.mjs) created freelancer
  // accounts named "Phase Six Tester" with empty headlines and zero
  // ratings. They leak into the homepage Recommended Services section
  // because it slices the first 4 freelancers. Delete them so only the
  // 5 production demo freelancers remain in the homepage demo set.
  await db.execute(sql`
    DELETE FROM reviews
    WHERE from_user_id IN (SELECT id FROM users WHERE full_name ILIKE 'Phase Six Tester%')
       OR to_user_id IN (SELECT id FROM users WHERE full_name ILIKE 'Phase Six Tester%')
  `);
  await db.execute(sql`
    DELETE FROM proposals
    WHERE freelancer_id IN (SELECT id FROM users WHERE full_name ILIKE 'Phase Six Tester%')
  `);
  await db.execute(sql`
    DELETE FROM freelancer_profiles
    WHERE user_id IN (SELECT id FROM users WHERE full_name ILIKE 'Phase Six Tester%')
  `);
  await db.execute(sql`
    DELETE FROM users WHERE full_name ILIKE 'Phase Six Tester%'
  `);

  // ---------- Demo marketplace content (jobs/proposals/payments/reviews) ----------
  // No natural unique key; gate on emptiness so re-running doesn't duplicate.
  const [{ count: existingJobsCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable);

  if (existingJobsCount === 0) {
    const jobsData: Array<{
      title: string;
      description: string;
      categorySlug: string;
      budgetType: string;
      budgetMin: number;
      budgetMax: number;
      skills: string[];
      clientIdx: number;
    }> = [
      {
        title: "Brand identity for a new Dubai fintech",
        description: "We're launching a fintech brand targeting SMBs in the UAE. Need a full identity: logo, color system, type, brand guidelines, business cards. Bilingual (EN/AR) is a must.",
        categorySlug: "design",
        budgetType: "fixed", budgetMin: 8000, budgetMax: 14000,
        skills: ["Branding", "Logo Design", "Figma"],
        clientIdx: 0,
      },
      {
        title: "Build a Next.js storefront for a luxury home brand",
        description: "Looking for a senior React/Next.js dev to build a high-end e-commerce storefront with bilingual support and a custom CMS-backed content layer.",
        categorySlug: "development",
        budgetType: "fixed", budgetMin: 25000, budgetMax: 40000,
        skills: ["Next.js", "React", "TypeScript", "Shopify"],
        clientIdx: 1,
      },
      {
        title: "Bilingual copywriting for our website relaunch",
        description: "We need confident, modern copy for 12 pages across our marketing site. Arabic-first, with parallel English versions.",
        categorySlug: "writing",
        budgetType: "fixed", budgetMin: 4000, budgetMax: 7000,
        skills: ["Arabic Copywriting", "English Copywriting", "Content Strategy"],
        clientIdx: 0,
      },
      {
        title: "Performance marketing manager (Meta + Google)",
        description: "Ongoing engagement to manage paid acquisition for our D2C brand across UAE/KSA. Monthly budget AED 80k.",
        categorySlug: "marketing",
        budgetType: "hourly", budgetMin: 200, budgetMax: 320,
        skills: ["Meta Ads", "Google Ads", "SEO"],
        clientIdx: 1,
      },
      {
        title: "Promo video for app launch",
        description: "30 to 60 second motion graphics promo for our consumer app launch. Bilingual subtitles. Need 3 cut variations.",
        categorySlug: "video",
        budgetType: "fixed", budgetMin: 5000, budgetMax: 9000,
        skills: ["Motion Graphics", "After Effects", "Video Editing"],
        clientIdx: 0,
      },
      {
        title: "Mobile app: iOS + Android (Flutter)",
        description: "Build a marketplace mobile app in Flutter, integrate with our existing API, deploy to both stores.",
        categorySlug: "development",
        budgetType: "fixed", budgetMin: 30000, budgetMax: 55000,
        skills: ["Flutter", "iOS", "Android"],
        clientIdx: 1,
      },
      {
        title: "Translate 40 pages of legal docs EN to AR",
        description: "Sworn translation quality required. Legal background a plus. PDF deliverable with parallel formatting.",
        categorySlug: "translation",
        budgetType: "fixed", budgetMin: 3000, budgetMax: 5500,
        skills: ["Translation EN-AR", "Arabic Copywriting"],
        clientIdx: 0,
      },
      {
        title: "Power BI dashboard for retail KPIs",
        description: "Connect to our SQL warehouse, build a 6-page dashboard tracking sales, returns, and store performance.",
        categorySlug: "data",
        budgetType: "fixed", budgetMin: 6000, budgetMax: 10000,
        skills: ["Power BI", "Data Analysis"],
        clientIdx: 1,
      },
      {
        title: "Bookkeeping + VAT filing for Dubai SME",
        description: "Monthly bookkeeping in Zoho Books, quarterly VAT returns to FTA, and an end-of-year financial pack for a Dubai-based trading SME.",
        categorySlug: "legal-finance",
        budgetType: "hourly", budgetMin: 60, budgetMax: 110,
        skills: ["Bookkeeping", "VAT Filing", "Zoho Books"],
        clientIdx: 0,
      },
      {
        title: "SEO audit and 90-day execution plan",
        description: "Full technical and content SEO audit for a regional content site, plus a quarterly execution roadmap with deliverables.",
        categorySlug: "marketing",
        budgetType: "fixed", budgetMin: 4500, budgetMax: 8000,
        skills: ["SEO", "Content Strategy"],
        clientIdx: 1,
      },
    ];

    const jobs = [];
    for (let i = 0; i < jobsData.length; i++) {
      const j = jobsData[i]!;
      const [job] = await db
        .insert(jobsTable)
        .values({
          clientId: clients[j.clientIdx]!.id,
          title: j.title,
          description: j.description,
          categorySlug: j.categorySlug,
          budgetType: j.budgetType,
          budgetMin: String(j.budgetMin),
          budgetMax: String(j.budgetMax),
          currency: "AED",
          skills: j.skills,
          status: i < 7 ? "open" : i < 9 ? "in_progress" : "completed",
          deadline: new Date(Date.now() + (14 + i * 3) * 86400000),
        })
        .returning();
      jobs.push(job!);
    }

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]!;
      const numProposals = 2 + (i % 3);
      for (let k = 0; k < numProposals; k++) {
        const f = freelancers[(i + k) % freelancers.length]!;
        await db.insert(proposalsTable).values({
          jobId: job.id,
          freelancerId: f.id,
          coverLetter: `I'd love to help on "${job.title}". I've shipped similar work for regional clients and can start within a few days. Happy to share relevant samples on a quick call.`,
          expectedRate: String(Number(job.budgetMin) + 500 + k * 250),
          deliveryDays: 14 + k * 5,
          portfolioLinks: ["https://example.com/work-1", "https://example.com/work-2"],
          status: i >= 9 ? (k === 0 ? "accepted" : "rejected") : k === 0 ? "shortlisted" : "pending",
        });
      }
    }

    const completedJobs = jobs.slice(9);
    for (const job of completedJobs) {
      await db.insert(paymentsTable).values({
        jobId: job.id,
        payerId: job.clientId,
        payeeId: freelancers[0]!.id,
        amount: String(Number(job.budgetMax)),
        currency: "AED",
        status: "succeeded",
        invoiceNumber: `INV-2026-${String(job.id).padStart(4, "0")}`,
        stripeIntentId: `pi_mock_seeded_${job.id}`,
      });
      await db.insert(reviewsTable).values({
        jobId: job.id,
        fromUserId: job.clientId,
        toUserId: freelancers[0]!.id,
        rating: 5,
        comment: "Excellent work, on time and beyond expectations. Will hire again.",
      });
      await db.insert(reviewsTable).values({
        jobId: job.id,
        fromUserId: freelancers[0]!.id,
        toUserId: job.clientId,
        rating: 5,
        comment: "Clear brief, prompt feedback, and fast payment. Highly recommended.",
      });
    }

    for (const f of freelancers.slice(0, 3)) {
      await db.insert(notificationsTable).values({
        userId: f.id,
        kind: "welcome",
        title: `Welcome to ${BRAND.name}`,
        body: "Complete your profile to start receiving proposals.",
        link: "/dashboard/freelancer/profile",
      });
    }
  } else {
    console.log(`Skipping demo jobs/proposals/payments — ${existingJobsCount} jobs already present.`);
  }

  // ---------- Phase 2: Legal documents (Terms, Privacy, NDA) ----------
  // Idempotent on (slug, version): re-running won't duplicate; brand-string
  // updates require bumping the version (which is the right legal pattern).
  await db
    .insert(legalDocumentsTable)
    .values([
      {
        slug: "terms",
        version: 1,
        titleEn: "Terms of Service",
        titleAr: "الشروط والأحكام",
        bodyEn:
          `These Terms of Service govern your access to and use of the ${BRAND.name} platform, ` +
          `a UAE-based marketplace for freelance services. By accessing or using ${BRAND.name} you ` +
          "agree to be bound by these terms, our Privacy Policy and applicable UAE laws " +
          "including the Federal Decree-Law No. 45 of 2021 on Personal Data Protection.",
        bodyAr:
          `تحكم هذه الشروط وصولك إلى منصة ${BRAND.nameAr} واستخدامك لها، وهي منصة مقرها الإمارات ` +
          "العربية المتحدة لخدمات العمل الحر. باستخدامك للمنصة فإنك توافق على هذه الشروط " +
          "وعلى سياسة الخصوصية والقوانين المعمول بها في دولة الإمارات.",
        isCurrent: true,
        publishedById: admin.id,
      },
      {
        slug: "privacy",
        version: 1,
        titleEn: "Privacy Policy",
        titleAr: "سياسة الخصوصية",
        bodyEn:
          `${BRAND.name} collects only the personal data needed to operate the marketplace: account ` +
          "information, profile details, payment records and communications. Data is stored " +
          "securely and is not shared with third parties except as required to provide the " +
          "service or as required by UAE law.",
        bodyAr:
          `تجمع منصة ${BRAND.nameAr} البيانات الشخصية اللازمة فقط لتشغيل السوق: معلومات الحساب وتفاصيل ` +
          "الملف الشخصي وسجلات الدفع والمراسلات. يتم تخزين البيانات بشكل آمن ولا تتم مشاركتها " +
          "مع أطراف ثالثة إلا حسب ما يقتضيه القانون.",
        isCurrent: true,
        publishedById: admin.id,
      },
      {
        slug: "nda",
        version: 1,
        titleEn: "Confidentiality Notice",
        titleAr: "إشعار السرية",
        bodyEn:
          `All briefs, files and communications exchanged on ${BRAND.name} are considered confidential ` +
          "between the contracting parties. Sharing client material outside the engagement " +
          "without written consent is prohibited.",
        bodyAr:
          `تعتبر جميع الملفات والمراسلات المتبادلة على منصة ${BRAND.nameAr} سرية بين الأطراف المتعاقدة. ` +
          "يحظر مشاركة مواد العميل خارج نطاق التعاقد دون موافقة كتابية.",
        isCurrent: true,
        publishedById: admin.id,
      },
    ])
    .onConflictDoNothing({ target: [legalDocumentsTable.slug, legalDocumentsTable.version] });

  // ---------- Phase 2: Platform settings (UPSERT on key) ----------
  const platformSettings = [
    { key: "platform_fee_pct", value: 10, isPublic: 1, description: "Platform service fee charged on milestone release" },
    { key: "vat_pct", value: 5, isPublic: 1, description: "UAE VAT applied to platform fee invoices" },
    { key: "default_currency", value: "AED", isPublic: 1, description: "Default platform currency" },
    { key: "support_email", value: BRAND.supportEmail, isPublic: 1, description: "Public-facing support contact" },
    { key: "max_upload_mb", value: 10, isPublic: 1, description: "Maximum upload size per file (MB)" },
    { key: "min_payout_aed", value: 100, isPublic: 0, description: "Minimum withdrawable balance for freelancer payout" },
    { key: "payment_gateway", value: "mock", isPublic: 0, description: "Active payment gateway adapter (mock|stripe|paytabs|telr)" },
    { key: "platform_trn", value: "100123456700003", isPublic: 1, description: `${BRAND.name} UAE Tax Registration Number for invoices` },
    { key: "manual_bank_account_name", value: process.env["MANUAL_BANK_ACCOUNT_NAME"] ?? BRAND.companyName, isPublic: 1, description: "Bank account holder name for manual transfers" },
    { key: "manual_bank_name", value: process.env["MANUAL_BANK_NAME"] ?? "Emirates NBD", isPublic: 1, description: "Bank name for manual transfers" },
    { key: "manual_bank_iban", value: process.env["MANUAL_BANK_IBAN"] ?? "AE000000000000000000000", isPublic: 1, description: "IBAN for manual transfers" },
    { key: "manual_bank_swift", value: process.env["MANUAL_BANK_SWIFT"] ?? "EBILAEAD", isPublic: 1, description: "SWIFT/BIC code for manual transfers" },
  ];
  await db
    .insert(platformSettingsTable)
    .values(platformSettings.map((s) => ({ ...s, updatedById: admin.id })))
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: {
        value: sql`excluded.value`,
        isPublic: sql`excluded.is_public`,
        description: sql`excluded.description`,
        updatedById: sql`excluded.updated_by_id`,
        updatedAt: sql`now()`,
      },
    });

  // ---------- Phase 5: Payment gateway registry (UPSERT on provider_code) ----------
  // Note: isActive is intentionally NOT overwritten — admins toggle gateways on/off
  // per environment and re-running the seed must not flip those switches.
  await db
    .insert(paymentGatewaysTable)
    .values([
      {
        name: "Stripe (cards)",
        providerCode: "stripe",
        isActive: false,
        mode: "TEST",
        supportedCurrencies: ["AED", "USD", "EUR", "GBP", "SAR"],
        configJson: { docs: "https://stripe.com/docs/api" },
        sortOrder: 10,
      },
      {
        name: "PayTabs",
        providerCode: "paytabs",
        isActive: false,
        mode: "TEST",
        supportedCurrencies: ["AED", "SAR", "USD", "EUR", "OMR", "JOD", "EGP"],
        configJson: { region: process.env["PAYTABS_REGION"] ?? "ARE" },
        sortOrder: 20,
      },
      {
        name: "Telr",
        providerCode: "telr",
        isActive: false,
        mode: "TEST",
        supportedCurrencies: ["AED", "SAR", "USD", "EUR", "GBP"],
        configJson: { docs: "https://telr.com/support/api/" },
        sortOrder: 30,
      },
      {
        name: "Manual bank transfer",
        providerCode: "manual",
        isActive: true,
        mode: "LIVE",
        supportedCurrencies: ["AED", "USD", "EUR", "SAR", "GBP"],
        configJson: { instructions: "Client uploads transfer proof; admin approves." },
        sortOrder: 40,
      },
      {
        name: "Mock gateway (development)",
        providerCode: "mock",
        isActive: false,
        mode: "TEST",
        supportedCurrencies: ["AED", "USD", "EUR"],
        configJson: { note: "For local smoke tests only." },
        sortOrder: 99,
      },
    ])
    .onConflictDoUpdate({
      target: paymentGatewaysTable.providerCode,
      set: {
        name: sql`excluded.name`,
        mode: sql`excluded.mode`,
        supportedCurrencies: sql`excluded.supported_currencies`,
        configJson: sql`excluded.config_json`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: sql`now()`,
      },
    });

  // ---------- Phase 4: Currencies (UPSERT on code) ----------
  await db
    .insert(currenciesTable)
    .values([
      { code: "AED", nameEn: "UAE Dirham", nameAr: "درهم إماراتي", symbol: "د.إ", decimals: 2 },
      { code: "USD", nameEn: "US Dollar", nameAr: "دولار أمريكي", symbol: "$", decimals: 2 },
      { code: "EUR", nameEn: "Euro", nameAr: "يورو", symbol: "€", decimals: 2 },
      { code: "SAR", nameEn: "Saudi Riyal", nameAr: "ريال سعودي", symbol: "﷼", decimals: 2 },
      { code: "GBP", nameEn: "British Pound", nameAr: "جنيه إسترليني", symbol: "£", decimals: 2 },
    ])
    .onConflictDoUpdate({
      target: currenciesTable.code,
      set: {
        nameEn: sql`excluded.name_en`,
        nameAr: sql`excluded.name_ar`,
        symbol: sql`excluded.symbol`,
        decimals: sql`excluded.decimals`,
      },
    });

  // ---------- Phase 4: FX rates (refresh seed-sourced snapshot) ----------
  // No natural unique key on (base, quote); the seed owns rows whose
  // source = 'seed', so we delete-then-insert that slice. Any non-seed
  // rates (e.g. live FX feed) are preserved.
  await db.delete(fxRatesTable).where(eq(fxRatesTable.source, "seed"));
  await db.insert(fxRatesTable).values([
    { base: "AED", quote: "USD", rate: "0.27226", source: "seed" },
    { base: "AED", quote: "EUR", rate: "0.25100", source: "seed" },
    { base: "AED", quote: "SAR", rate: "1.02100", source: "seed" },
    { base: "AED", quote: "GBP", rate: "0.21500", source: "seed" },
    { base: "USD", quote: "AED", rate: "3.67250", source: "seed" },
    { base: "EUR", quote: "AED", rate: "3.98400", source: "seed" },
  ]);

  // ---------- Phase 4: Subscription plans (UPSERT on slug) ----------
  await db
    .insert(subscriptionPlansTable)
    .values([
      {
        slug: "freelancer_pro",
        nameEn: "Freelancer Pro",
        nameAr: "محترف",
        descriptionEn: "Boost visibility, unlimited proposals and priority support.",
        descriptionAr: "ظهور أعلى، عروض غير محدودة ودعم ذو أولوية.",
        audience: "freelancer",
        period: "monthly",
        priceAed: "99.00",
        features: ["unlimited_proposals", "profile_boost", "priority_support", "verified_badge_eligible"],
        sortOrder: 1,
      },
      {
        slug: "client_business",
        nameEn: "Client Business",
        nameAr: "أعمال",
        descriptionEn: "Featured job postings, advanced talent search and dedicated success manager.",
        descriptionAr: "إعلانات وظائف مميزة، بحث متقدم عن المواهب ومدير نجاح مخصص.",
        audience: "client",
        period: "monthly",
        priceAed: "299.00",
        features: ["featured_job_credits_5", "advanced_search", "team_seats_3", "dedicated_manager"],
        sortOrder: 2,
      },
    ])
    .onConflictDoUpdate({
      target: subscriptionPlansTable.slug,
      set: {
        nameEn: sql`excluded.name_en`,
        nameAr: sql`excluded.name_ar`,
        descriptionEn: sql`excluded.description_en`,
        descriptionAr: sql`excluded.description_ar`,
        audience: sql`excluded.audience`,
        period: sql`excluded.period`,
        priceAed: sql`excluded.price_aed`,
        features: sql`excluded.features`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  // ---------- Phase 6: Admin role + content ----------
  // Promote primary admin to super_admin (admin role + adminRole = super_admin).
  // Idempotent UPDATE — safe to re-run.
  await db.execute(sql`UPDATE users SET admin_role = 'super_admin' WHERE email = 'admin@atmemly.com'`);

  await db
    .insert(cmsPagesTable)
    .values([
      {
        slug: "about-us",
        locale: "en",
        title: `About ${BRAND.name}`,
        body: `${BRAND.name} is the UAE's bilingual freelance marketplace connecting top regional talent with growing companies across the GCC.`,
        seoTitle: `About ${BRAND.name} — UAE freelance marketplace`,
        seoDescription: `Learn about ${BRAND.name}'s mission to power the UAE freelance economy.`,
        isPublished: true,
        updatedById: admin.id,
      },
      {
        slug: "about-us",
        locale: "ar",
        title: `عن ${BRAND.nameAr}`,
        body: `${BRAND.nameAr} هي منصة العمل الحر ثنائية اللغة في الإمارات تربط أفضل المواهب الإقليمية بالشركات النامية في دول الخليج.`,
        seoTitle: `عن ${BRAND.nameAr} — منصة العمل الحر في الإمارات`,
        seoDescription: `تعرف على رسالة ${BRAND.nameAr} في تمكين اقتصاد العمل الحر في الإمارات.`,
        isPublished: true,
        updatedById: admin.id,
      },
      {
        slug: "contact",
        locale: "en",
        title: "Contact Us",
        body: `<p>Reach the ${BRAND.name} team using the form below. We typically reply within one business day.</p>`,
        seoTitle: `Contact ${BRAND.name}`,
        seoDescription: `Get in touch with the ${BRAND.name} support team.`,
        isPublished: true,
        updatedById: admin.id,
      },
      {
        slug: "contact",
        locale: "ar",
        title: "اتصل بنا",
        body: `<p>تواصل مع فريق ${BRAND.nameAr} عبر النموذج أدناه. عادةً ما نرد خلال يوم عمل واحد.</p>`,
        seoTitle: `اتصل بـ ${BRAND.nameAr}`,
        seoDescription: `تواصل مع فريق دعم ${BRAND.nameAr}.`,
        isPublished: true,
        updatedById: admin.id,
      },
      ...(["cancellation", "help", "how-it-works", "terms", "privacy"] as const).flatMap((slug) => {
        const titles = {
          "cancellation": { en: "Cancellation Policy", ar: "سياسة الإلغاء" },
          "help": { en: "Help Center", ar: "مركز المساعدة" },
          "how-it-works": { en: "How It Works", ar: "كيف يعمل" },
          "terms": { en: "Terms of Service", ar: "شروط الاستخدام" },
          "privacy": { en: "Privacy Policy", ar: "سياسة الخصوصية" },
        }[slug];
        const bodyEn = {
          "cancellation": `<p>${BRAND.name} supports cancellation requests within the platform. Refund eligibility depends on milestone status and the seller's response.</p>`,
          "help": `<p>Browse our FAQs or contact ${BRAND.name} support for assistance with your account, projects or payments.</p>`,
          "how-it-works": `<p>${BRAND.name} connects clients with vetted GCC freelancers. Post a project, review proposals, and pay safely through escrow.</p>`,
          "terms": `<p>These Terms of Service govern your use of ${BRAND.name}. By creating an account or browsing the marketplace you agree to these terms, our acceptable-use policy, and the dispute-resolution process described below.</p>`,
          "privacy": `<p>${BRAND.name} respects your privacy. This policy explains what personal data we collect, how we use it to operate the marketplace, and the choices you have over your information.</p>`,
        }[slug];
        const bodyAr = {
          "cancellation": `<p>تدعم ${BRAND.nameAr} طلبات الإلغاء من داخل المنصة. تعتمد أهلية الاسترداد على حالة المرحلة ورد البائع.</p>`,
          "help": `<p>تصفح الأسئلة الشائعة أو تواصل مع دعم ${BRAND.nameAr} للحصول على المساعدة في حسابك أو مشاريعك أو مدفوعاتك.</p>`,
          "how-it-works": `<p>تربط ${BRAND.nameAr} العملاء بمستقلين موثوقين في دول الخليج. انشر مشروعك، راجع العروض، وادفع بأمان عبر نظام الضمان.</p>`,
          "terms": `<p>تحكم شروط الاستخدام هذه استخدامك لمنصة ${BRAND.nameAr}. بإنشائك حسابًا أو تصفحك للمنصة فإنك توافق على هذه الشروط وسياسة الاستخدام المقبول وآلية حل النزاعات الموضحة أدناه.</p>`,
          "privacy": `<p>تحترم ${BRAND.nameAr} خصوصيتك. توضح هذه السياسة البيانات الشخصية التي نجمعها وكيفية استخدامها لتشغيل المنصة والخيارات المتاحة لك بشأن معلوماتك.</p>`,
        }[slug];
        return [
          {
            slug, locale: "en", title: titles.en, body: bodyEn,
            seoTitle: `${titles.en} — ${BRAND.name}`,
            seoDescription: `${titles.en} on ${BRAND.name}.`,
            isPublished: true, updatedById: admin.id,
          },
          {
            slug, locale: "ar", title: titles.ar, body: bodyAr,
            seoTitle: `${titles.ar} — ${BRAND.nameAr}`,
            seoDescription: `${titles.ar} على ${BRAND.nameAr}.`,
            isPublished: true, updatedById: admin.id,
          },
        ];
      }),
    ])
    .onConflictDoNothing({ target: [cmsPagesTable.slug, cmsPagesTable.locale] });

  await db
    .insert(cmsBlocksTable)
    .values([
      {
        key: "homepage_hero",
        locale: "en",
        title: "Hire trusted freelancers in the UAE",
        body: "Connect with verified Arabic and English speaking freelancers across the GCC.",
        updatedById: admin.id,
      },
      {
        key: "homepage_hero",
        locale: "ar",
        title: "وظف مستقلين موثوقين في الإمارات",
        body: "تواصل مع مستقلين موثقين يتحدثون العربية والإنجليزية في جميع أنحاء الخليج.",
        updatedById: admin.id,
      },
    ])
    .onConflictDoNothing({ target: [cmsBlocksTable.key, cmsBlocksTable.locale] });

  await db
    .insert(blogPostsTable)
    .values([
      {
        slug: "welcome-to-atmemly",
        locale: "en",
        title: `Welcome to ${BRAND.name}`,
        excerpt: "We're launching the UAE's bilingual freelance marketplace.",
        body: `Today we're proud to launch ${BRAND.name} — the marketplace built for UAE freelancers and clients...`,
        category: "announcements",
        tags: ["launch", "uae", "freelance"],
        coverUrl: "/assets/blog/blog-01.svg",
        isPublished: true,
        publishedAt: new Date(),
        authorId: admin.id,
      },
      {
        slug: "writing-a-winning-proposal",
        locale: "en",
        title: `How to write a winning proposal on ${BRAND.name}`,
        excerpt: "Five simple rules that consistently turn proposals into accepted contracts.",
        body: "A great proposal is short, specific, and focused on the client's outcome — here's how to write one...",
        category: "tips",
        tags: ["proposals", "freelancers"],
        coverUrl: "/assets/blog/blog-02.svg",
        isPublished: true,
        publishedAt: new Date(Date.now() - 4 * 86400000),
        authorId: admin.id,
      },
      {
        slug: "client-guide-2026",
        locale: "en",
        title: "Client guide: hiring the right freelancer in 2026",
        excerpt: "From writing the brief to closing the contract — your end-to-end hiring playbook.",
        body: "Hiring well starts with a clear brief. Here's how to structure yours so the best freelancers respond...",
        category: "guides",
        tags: ["clients", "hiring"],
        coverUrl: "/assets/blog/blog-03.svg",
        isPublished: true,
        publishedAt: new Date(Date.now() - 9 * 86400000),
        authorId: admin.id,
      },
      {
        slug: "welcome-to-atmemly",
        locale: "ar",
        title: `مرحباً بكم في ${BRAND.nameAr}`,
        excerpt: "نطلق منصة العمل الحر ثنائية اللغة في الإمارات.",
        body: `اليوم نفخر بإطلاق ${BRAND.nameAr} — المنصة المبنية للمستقلين والعملاء في الإمارات...`,
        category: "إعلانات",
        tags: ["إطلاق", "الإمارات", "عمل-حر"],
        coverUrl: "/assets/blog/blog-01.svg",
        isPublished: true,
        publishedAt: new Date(),
        authorId: admin.id,
      },
      {
        slug: "writing-a-winning-proposal",
        locale: "ar",
        title: `كيف تكتب عرضاً فائزاً على منصة ${BRAND.nameAr}`,
        excerpt: "خمس قواعد بسيطة تحوّل عروضك إلى عقود مقبولة باستمرار.",
        body: "العرض المميز قصير ومحدد ويركز على نتيجة العميل — وإليك طريقة كتابته...",
        category: "نصائح",
        tags: ["عروض", "مستقلين"],
        coverUrl: "/assets/blog/blog-02.svg",
        isPublished: true,
        publishedAt: new Date(Date.now() - 4 * 86400000),
        authorId: admin.id,
      },
      {
        slug: "client-guide-2026",
        locale: "ar",
        title: "دليل العميل: كيف تختار المستقل المناسب في 2026",
        excerpt: "من كتابة المواصفات حتى توقيع العقد — دليلك المتكامل للتوظيف.",
        body: "يبدأ التوظيف الجيد بمواصفات واضحة. إليك كيف تنظمها لجذب أفضل المستقلين...",
        category: "أدلة",
        tags: ["عملاء", "توظيف"],
        coverUrl: "/assets/blog/blog-03.svg",
        isPublished: true,
        publishedAt: new Date(Date.now() - 9 * 86400000),
        authorId: admin.id,
      },
    ])
    .onConflictDoNothing({ target: [blogPostsTable.slug, blogPostsTable.locale] });

  // ---------- FAQ items + testimonials (no natural unique key — gate on emptiness) ----------
  const [{ count: faqCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(faqItemsTable);
  if (faqCount === 0) {
    await db.insert(faqItemsTable).values([
      { locale: "en", category: "getting-started", question: `How do I create a ${BRAND.name} account?`,
        answer: "Click Sign Up, enter your email, verify it, and complete your profile.", sortOrder: 10 },
      { locale: "en", category: "payments", question: `How does escrow work on ${BRAND.name}?`,
        answer: "Clients fund a milestone in advance. Funds are released when work is approved.", sortOrder: 20 },
      { locale: "en", category: "fees", question: `Are there any fees to join ${BRAND.name}?`,
        answer: "Creating an account and posting a project is free. We charge a small platform fee on completed contracts.", sortOrder: 30 },
      { locale: "en", category: "support", question: "How do I contact support?",
        answer: `Use the Contact Us page or email ${BRAND.email} — we usually respond within a few hours.`, sortOrder: 40 },
      { locale: "ar", category: "البدء", question: `كيف أنشئ حساباً في ${BRAND.nameAr}؟`,
        answer: "انقر على إنشاء حساب، أدخل بريدك الإلكتروني، وأكد التحقق وأكمل ملفك الشخصي.", sortOrder: 10 },
      { locale: "ar", category: "المدفوعات", question: `كيف يعمل نظام الضمان في ${BRAND.nameAr}؟`,
        answer: "يمول العميل قيمة المرحلة مسبقاً، ويُفرج عن المبلغ للمستقل عند اعتماد التسليم.", sortOrder: 20 },
      { locale: "ar", category: "الرسوم", question: `هل هناك رسوم للانضمام إلى ${BRAND.nameAr}؟`,
        answer: "إنشاء الحساب ونشر المشاريع مجاني. نحتسب عمولة بسيطة على العقود المكتملة فقط.", sortOrder: 30 },
      { locale: "ar", category: "المستقلون", question: `كيف أبدأ كمستقل على ${BRAND.nameAr}؟`,
        answer: "أكمل ملفك الشخصي، أضف أعمالك السابقة، وقدّم عروضاً على المشاريع التي تناسب تخصصك.", sortOrder: 40 },
      { locale: "ar", category: "الدعم", question: "كيف أتواصل مع فريق الدعم؟",
        answer: `استخدم صفحة تواصل معنا أو راسلنا على ${BRAND.email} — نرد عادةً خلال ساعات قليلة.`, sortOrder: 50 },
      { locale: "ar", category: "الأمان", question: "هل بياناتي آمنة على المنصة؟",
        answer: "نعم. نستخدم تشفيراً قوياً ولا نشارك بياناتك مع أي طرف ثالث دون إذنك.", sortOrder: 60 },
    ]);
  }

  const [{ count: testimonialsCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(testimonialsTable);
  if (testimonialsCount === 0) {
    await db.insert(testimonialsTable).values([
      { locale: "en", authorName: "Aisha Al-Mansoori", authorTitle: "UAE SME owner — Dubai",
        body: `${BRAND.name} helped us hire a top-tier Arabic copywriter in two days. Smooth, fast, professional.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 10 },
      { locale: "en", authorName: "Mohammed Al-Khalifa", authorTitle: "Saudi startup founder — Riyadh",
        body: `We've hired three full-stack developers through ${BRAND.name} — every single hire has been excellent.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 20 },
      { locale: "en", authorName: "Sara Al-Otaibi", authorTitle: "GCC marketing manager — Jeddah",
        body: "Reliable freelancers, clean payments, and a beautiful Arabic interface. It's the marketplace we needed.",
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 30 },
      { locale: "en", authorName: "Hamad Al Thani", authorTitle: "Dubai consultant",
        body: `${BRAND.name} is the only marketplace where I get bilingual proposals from real GCC professionals — same-day, every time.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 40 },
      { locale: "ar", authorName: "ليلى حسن", authorTitle: "مستقلة محلية — أبوظبي",
        body: `وجدت أفضل عملائي عبر ${BRAND.nameAr}. النظام الآمن للضمان يجعلني مرتاحة كل شهر، والمنصة بسيطة وأنيقة.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 10 },
      { locale: "ar", authorName: "خالد المنصوري", authorTitle: "صاحب شركة صغيرة في الإمارات — دبي",
        body: `ساعدتنا منصة ${BRAND.nameAr} في توظيف كاتب إعلاني عربي محترف خلال يومين فقط. تجربة احترافية وسريعة.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 20 },
      { locale: "ar", authorName: "سارة العتيبي", authorTitle: "مديرة تسويق خليجية — جدة",
        body: "مستقلون موثوقون، مدفوعات نظيفة، وواجهة عربية جميلة. هذه هي المنصة التي كنا نحتاجها فعلاً.",
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 30 },
      { locale: "ar", authorName: "عمر السعدي", authorTitle: "مؤسس شركة ناشئة سعودية — الرياض",
        body: `كمستقل ومؤسس، ${BRAND.nameAr} منحتني وصولاً لعملاء جديين عبر الخليج والمدفوعات تصل دائماً في وقتها.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 40 },
      { locale: "ar", authorName: "حمد آل ثاني", authorTitle: "مستشار أعمال — دبي",
        body: `أتمملي هي السوق الوحيد الذي يقدم لي عروضاً ثنائية اللغة من محترفين خليجيين حقيقيين، في نفس اليوم.`,
        rating: 5, avatarUrl: null, isFeatured: true, sortOrder: 50 },
    ]);
  }

  // CMS singletons + nav/footer/SEO/i18n seed (idempotent).
  const [hpRow] = await db.select().from(cmsHomepageTable).limit(1);
  if (!hpRow) {
    await db.insert(cmsHomepageTable).values({
      data: {
        hero: {
          titleAr: `أتمملي — سوق المستقلين في الإمارات والخليج`,
          titleEn: `${BRAND.platformName} — UAE & GCC freelance marketplace`,
          subtitleAr: "اعثر على أفضل المستقلين العرب أو احصل على مشروعك التالي بثقة.",
          subtitleEn: "Find top Arabic-speaking freelancers or land your next project with confidence.",
          searchPlaceholderAr: "ابحث عن خدمة أو مهارة...",
          searchPlaceholderEn: "Search for a service or skill...",
          imageUrl: "",
          ctaPrimaryLabelAr: "ابدأ الآن", ctaPrimaryLabelEn: "Get started", ctaPrimaryHref: "/post-job",
          ctaSecondaryLabelAr: "تصفح المستقلين", ctaSecondaryLabelEn: "Browse freelancers", ctaSecondaryHref: "/freelancers",
        },
        sections: [
          { key: "categories", titleAr: "الفئات", titleEn: "Categories", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 0 },
          { key: "featured_freelancers", titleAr: "المستقلون المميزون", titleEn: "Featured freelancers", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 1 },
          { key: "featured_jobs", titleAr: "الوظائف المميزة", titleEn: "Featured jobs", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 2 },
          { key: "how_it_works", titleAr: "كيف يعمل", titleEn: "How it works", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 3 },
          { key: "testimonials", titleAr: "آراء العملاء", titleEn: "Testimonials", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 4 },
          { key: "blog", titleAr: "المدونة", titleEn: "Blog", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 5 },
          { key: "cta", titleAr: "ابدأ مشروعك اليوم", titleEn: "Start your project today", subtitleAr: "", subtitleEn: "", isVisible: true, sortOrder: 6 },
        ],
      },
    });
  }

  const [seoRow] = await db.select().from(seoSettingsTable).limit(1);
  if (!seoRow) {
    await db.insert(seoSettingsTable).values({
      siteTitleAr: `أتمملي — منصة المستقلين في الإمارات`,
      siteTitleEn: `${BRAND.platformName} — UAE freelance marketplace`,
      siteDescriptionAr: "وظّف مستقلين عرب موهوبين في الإمارات والخليج. مدفوعات آمنة بنظام الضمان.",
      siteDescriptionEn: "Hire talented Arabic-speaking freelancers across the UAE & GCC. Secure escrow-backed payments.",
      ogImageUrl: null,
      twitterHandle: null,
      defaultLocale: "ar",
    });
  }

  const [fsRow] = await db.select().from(footerSettingsTable).limit(1);
  if (!fsRow) {
    await db.insert(footerSettingsTable).values({
      descriptionAr: `${BRAND.platformNameAr} هي منصة المستقلين الرائدة في الإمارات والخليج، تربط بين المواهب العربية والشركات.`,
      descriptionEn: `${BRAND.platformName} is the leading UAE & GCC freelance marketplace connecting Arabic-speaking talent with businesses.`,
      contactEmail: BRAND.email,
      contactPhone: "+971 4 000 0000",
      whatsapp: "+971500000000",
      addressAr: "دبي، الإمارات العربية المتحدة",
      addressEn: "Dubai, United Arab Emirates",
      copyrightAr: `${BRAND.platformNameAr}. جميع الحقوق محفوظة.`,
      copyrightEn: `${BRAND.platformName}. All rights reserved.`,
      socialLinks: [
        { platform: "twitter", url: "https://twitter.com/atmemly" },
        { platform: "linkedin", url: "https://linkedin.com/company/atmemly" },
        { platform: "instagram", url: "https://instagram.com/atmemly" },
      ],
    });
  }

  const existingGroups = await db.select().from(footerLinkGroupsTable).limit(1);
  if (existingGroups.length === 0) {
    const [platform] = await db.insert(footerLinkGroupsTable).values({ titleAr: "المنصة", titleEn: "Platform", sortOrder: 0, isActive: true }).returning();
    const [company] = await db.insert(footerLinkGroupsTable).values({ titleAr: "الشركة", titleEn: "Company", sortOrder: 1, isActive: true }).returning();
    const [legal] = await db.insert(footerLinkGroupsTable).values({ titleAr: "قانوني", titleEn: "Legal", sortOrder: 2, isActive: true }).returning();
    await db.insert(footerLinksTable).values([
      { groupId: platform!.id, labelAr: "الوظائف والمشاريع", labelEn: "Jobs & Projects", href: "/jobs", sortOrder: 0, isActive: true },
      { groupId: platform!.id, labelAr: "المستقلون", labelEn: "Freelancers", href: "/freelancers", sortOrder: 1, isActive: true },
      { groupId: platform!.id, labelAr: "المدونة", labelEn: "Blog", href: "/blog", sortOrder: 2, isActive: true },
      { groupId: platform!.id, labelAr: "كيف يعمل", labelEn: "How it works", href: "/about", sortOrder: 3, isActive: true },
      { groupId: company!.id, labelAr: "من نحن", labelEn: "About us", href: "/about", sortOrder: 0, isActive: true },
      { groupId: company!.id, labelAr: "تواصل معنا", labelEn: "Contact", href: "/contact", sortOrder: 1, isActive: true },
      { groupId: legal!.id, labelAr: "الشروط والأحكام", labelEn: "Terms", href: "/terms", sortOrder: 0, isActive: true },
      { groupId: legal!.id, labelAr: "سياسة الخصوصية", labelEn: "Privacy", href: "/privacy", sortOrder: 1, isActive: true },
      { groupId: legal!.id, labelAr: "سياسة الإلغاء", labelEn: "Cancellation", href: "/cancellation", sortOrder: 2, isActive: true },
    ]);
  }

  const existingNav = await db.select().from(navigationItemsTable).limit(1);
  if (existingNav.length === 0) {
    await db.insert(navigationItemsTable).values([
      { location: "HEADER", parentId: null, labelAr: "الخدمات", labelEn: "Services", href: "/jobs?tab=services", sortOrder: 0, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "المشاريع", labelEn: "Projects", href: "/jobs", sortOrder: 1, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "الأعمال", labelEn: "Works", href: "/freelancers?tab=works", sortOrder: 2, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "المستقلون", labelEn: "Freelancers", href: "/freelancers", sortOrder: 3, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "المجتمع", labelEn: "Community", href: "/about", sortOrder: 4, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "المدونة", labelEn: "Blog", href: "/blog", sortOrder: 5, isActive: true },
      { location: "HEADER", parentId: null, labelAr: "المساعدة", labelEn: "Help", href: "/contact", sortOrder: 6, isActive: true },
    ]);
  }

  const existingBlogCats = await db.select().from(blogCategoriesTable).limit(1);
  if (existingBlogCats.length === 0) {
    await db.insert(blogCategoriesTable).values([
      { slug: "tips", nameAr: "نصائح", nameEn: "Tips", sortOrder: 0, isActive: true },
      { slug: "guides", nameAr: "أدلة", nameEn: "Guides", sortOrder: 1, isActive: true },
      { slug: "news", nameAr: "أخبار", nameEn: "News", sortOrder: 2, isActive: true },
    ]);
  }
  const existingFaqCats = await db.select().from(faqCategoriesTable).limit(1);
  if (existingFaqCats.length === 0) {
    await db.insert(faqCategoriesTable).values([
      { slug: "general", nameAr: "عام", nameEn: "General", sortOrder: 0, isActive: true },
      { slug: "payments", nameAr: "المدفوعات", nameEn: "Payments", sortOrder: 1, isActive: true },
      { slug: "freelancers", nameAr: "للمستقلين", nameEn: "For freelancers", sortOrder: 2, isActive: true },
      { slug: "clients", nameAr: "للعملاء", nameEn: "For clients", sortOrder: 3, isActive: true },
    ]);
  }

  // Sample localization strings — ATMEMLY-branded greetings.
  const seedStrings: Array<{ key: string; namespace: string; ar: string; en: string }> = [
    { namespace: "common", key: "brand.tagline", ar: "سوق المستقلين العرب الموثوق", en: "The trusted Arabic freelance marketplace" },
    { namespace: "common", key: "common.welcome", ar: "مرحبًا بك في أتمملي", en: "Welcome to ATMEMLY" },
    { namespace: "cta", key: "cta.post_job", ar: "انشر مشروعًا", en: "Post a project" },
    { namespace: "cta", key: "cta.find_work", ar: "ابحث عن عمل", en: "Find work" },
  ];
  for (const r of seedStrings) {
    for (const locale of ["ar", "en"] as const) {
      await db.insert(localizationStringsTable).values({
        key: r.key, namespace: r.namespace, locale, value: locale === "ar" ? r.ar : r.en, isMissing: false,
      }).onConflictDoNothing({ target: [localizationStringsTable.key, localizationStringsTable.locale] });
    }
  }

  await db
    .insert(bannedWordsTable)
    .values([
      { word: "scam", locale: "en", severity: "high", createdById: admin.id },
      { word: "fraud", locale: "en", severity: "high", createdById: admin.id },
      { word: "spam", locale: "en", severity: "med", createdById: admin.id },
      { word: "احتيال", locale: "ar", severity: "high", createdById: admin.id },
      { word: "نصب", locale: "ar", severity: "high", createdById: admin.id },
    ])
    .onConflictDoNothing({ target: [bannedWordsTable.word, bannedWordsTable.locale] });

  console.log("Done.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
