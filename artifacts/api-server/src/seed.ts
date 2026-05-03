import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
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
} from "@workspace/db";

async function hash(p: string) {
  return bcrypt.hash(p, 10);
}

async function main() {
  console.log("Seeding…");
  await db.execute(sql`TRUNCATE TABLE
    consents, dispute_messages, disputes, attachments, legal_documents, platform_settings,
    notifications, payments, reviews, messages, conversations,
    saved_jobs, proposals, jobs, complaints,
    freelancer_profiles, client_profiles, users, skills, categories,
    device_tokens, escrow_events, payout_batch_items, payout_batches,
    featured_listings, user_subscriptions, subscription_plans,
    moderation_reports, currencies, fx_rates,
    payment_webhooks, payment_intents, payment_transactions, payment_gateways,
    admin_notes, cms_pages, cms_blocks, blog_posts, faq_items, testimonials, banned_words
    RESTART IDENTITY CASCADE`);

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
  await db.insert(categoriesTable).values(categories);

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
  await db.insert(skillsTable).values(skills.map((name) => ({ name })));

  const adminPwd = await hash("admin1234");
  const clientPwd = await hash("client1234");
  const freelancerPwd = await hash("freelancer1234");

  const [admin] = await db
    .insert(usersTable)
    .values({
      email: "admin@atmemly.com",
      passwordHash: adminPwd,
      fullName: `${BRAND.name} Admin`,
      role: "admin",
      avatarUrl: null,
    })
    .returning();
  void admin;

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
  const clients = [];
  for (const c of clientsData) {
    const [u] = await db
      .insert(usersTable)
      .values({
        email: c.email,
        passwordHash: clientPwd,
        fullName: c.fullName,
        role: "client",
        avatarUrl: null,
      })
      .returning();
    await db.insert(clientProfilesTable).values({
      userId: u!.id,
      companyName: c.companyName,
      overview: c.overview,
      location: c.location,
      logoUrl: null,
    });
    clients.push(u!);
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
    const [u] = await db
      .insert(usersTable)
      .values({
        email: f.email,
        passwordHash: freelancerPwd,
        fullName: f.fullName,
        role: "freelancer",
        avatarUrl: null,
      })
      .returning();
    await db.insert(freelancerProfilesTable).values({
      userId: u!.id,
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
    });
    freelancers.push({ id: u!.id, fullName: u!.fullName });
  }

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

  // ---------- Phase 2: Legal documents (Terms, Privacy, NDA) ----------
  await db.insert(legalDocumentsTable).values([
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
      publishedById: admin!.id,
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
      publishedById: admin!.id,
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
      publishedById: admin!.id,
    },
  ]);

  // ---------- Phase 2: Platform settings ----------
  await db.insert(platformSettingsTable).values([
    {
      key: "platform_fee_pct",
      value: 10,
      isPublic: 1,
      description: "Platform service fee charged on milestone release",
      updatedById: admin!.id,
    },
    {
      key: "vat_pct",
      value: 5,
      isPublic: 1,
      description: "UAE VAT applied to platform fee invoices",
      updatedById: admin!.id,
    },
    {
      key: "default_currency",
      value: "AED",
      isPublic: 1,
      description: "Default platform currency",
      updatedById: admin!.id,
    },
    {
      key: "support_email",
      value: BRAND.supportEmail,
      isPublic: 1,
      description: "Public-facing support contact",
      updatedById: admin!.id,
    },
    {
      key: "max_upload_mb",
      value: 10,
      isPublic: 1,
      description: "Maximum upload size per file (MB)",
      updatedById: admin!.id,
    },
    {
      key: "min_payout_aed",
      value: 100,
      isPublic: 0,
      description: "Minimum withdrawable balance for freelancer payout",
      updatedById: admin!.id,
    },
    {
      key: "payment_gateway",
      value: "mock",
      isPublic: 0,
      description: "Active payment gateway adapter (mock|stripe|paytabs|telr)",
      updatedById: admin!.id,
    },
    {
      key: "platform_trn",
      value: "100123456700003",
      isPublic: 1,
      description: `${BRAND.name} UAE Tax Registration Number for invoices`,
      updatedById: admin!.id,
    },
    {
      key: "manual_bank_account_name",
      value: process.env["MANUAL_BANK_ACCOUNT_NAME"] ?? BRAND.companyName,
      isPublic: 1,
      description: "Bank account holder name for manual transfers",
      updatedById: admin!.id,
    },
    {
      key: "manual_bank_name",
      value: process.env["MANUAL_BANK_NAME"] ?? "Emirates NBD",
      isPublic: 1,
      description: "Bank name for manual transfers",
      updatedById: admin!.id,
    },
    {
      key: "manual_bank_iban",
      value: process.env["MANUAL_BANK_IBAN"] ?? "AE000000000000000000000",
      isPublic: 1,
      description: "IBAN for manual transfers",
      updatedById: admin!.id,
    },
    {
      key: "manual_bank_swift",
      value: process.env["MANUAL_BANK_SWIFT"] ?? "EBILAEAD",
      isPublic: 1,
      description: "SWIFT/BIC code for manual transfers",
      updatedById: admin!.id,
    },
  ]);

  // ---------- Phase 5: Payment gateway registry ----------
  await db.insert(paymentGatewaysTable).values([
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
  ]);

  // ---------- Phase 4: Currencies + FX rates ----------
  await db.insert(currenciesTable).values([
    { code: "AED", nameEn: "UAE Dirham", nameAr: "درهم إماراتي", symbol: "د.إ", decimals: 2 },
    { code: "USD", nameEn: "US Dollar", nameAr: "دولار أمريكي", symbol: "$", decimals: 2 },
    { code: "EUR", nameEn: "Euro", nameAr: "يورو", symbol: "€", decimals: 2 },
    { code: "SAR", nameEn: "Saudi Riyal", nameAr: "ريال سعودي", symbol: "﷼", decimals: 2 },
    { code: "GBP", nameEn: "British Pound", nameAr: "جنيه إسترليني", symbol: "£", decimals: 2 },
  ]);
  await db.insert(fxRatesTable).values([
    { base: "AED", quote: "USD", rate: "0.27226", source: "seed" },
    { base: "AED", quote: "EUR", rate: "0.25100", source: "seed" },
    { base: "AED", quote: "SAR", rate: "1.02100", source: "seed" },
    { base: "AED", quote: "GBP", rate: "0.21500", source: "seed" },
    { base: "USD", quote: "AED", rate: "3.67250", source: "seed" },
    { base: "EUR", quote: "AED", rate: "3.98400", source: "seed" },
  ]);

  // ---------- Phase 4: Subscription plans ----------
  await db.insert(subscriptionPlansTable).values([
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
  ]);

  // ---------- Phase 6: Admin role + content ----------
  // Promote primary admin to super_admin (admin role + adminRole = super_admin).
  await db.execute(sql`UPDATE users SET admin_role = 'super_admin' WHERE email = 'admin@atmemly.com'`);

  await db.insert(cmsPagesTable).values([
    {
      slug: "about-us",
      locale: "en",
      title: `About ${BRAND.name}`,
      body: `${BRAND.name} is the UAE's bilingual freelance marketplace connecting top regional talent with growing companies across the GCC.`,
      seoTitle: `About ${BRAND.name} — UAE freelance marketplace`,
      seoDescription: `Learn about ${BRAND.name}'s mission to power the UAE freelance economy.`,
      isPublished: true,
      updatedById: 1,
    },
    {
      slug: "about-us",
      locale: "ar",
      title: `عن ${BRAND.nameAr}`,
      body: `${BRAND.nameAr} هي منصة العمل الحر ثنائية اللغة في الإمارات تربط أفضل المواهب الإقليمية بالشركات النامية في دول الخليج.`,
      seoTitle: `عن ${BRAND.nameAr} — منصة العمل الحر في الإمارات`,
      seoDescription: `تعرف على رسالة ${BRAND.nameAr} في تمكين اقتصاد العمل الحر في الإمارات.`,
      isPublished: true,
      updatedById: 1,
    },
  ]);

  await db.insert(cmsBlocksTable).values([
    {
      key: "homepage_hero",
      locale: "en",
      title: "Hire trusted freelancers in the UAE",
      body: "Connect with verified Arabic and English speaking freelancers across the GCC.",
      updatedById: 1,
    },
    {
      key: "homepage_hero",
      locale: "ar",
      title: "وظف مستقلين موثوقين في الإمارات",
      body: "تواصل مع مستقلين موثقين يتحدثون العربية والإنجليزية في جميع أنحاء الخليج.",
      updatedById: 1,
    },
  ]);

  await db.insert(blogPostsTable).values([
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
      authorId: 1,
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
      authorId: 1,
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
      authorId: 1,
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
      authorId: 1,
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
      authorId: 1,
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
      authorId: 1,
    },
  ]);

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

  await db.insert(bannedWordsTable).values([
    { word: "scam", locale: "en", severity: "high", createdById: 1 },
    { word: "fraud", locale: "en", severity: "high", createdById: 1 },
    { word: "spam", locale: "en", severity: "med", createdById: 1 },
    { word: "احتيال", locale: "ar", severity: "high", createdById: 1 },
    { word: "نصب", locale: "ar", severity: "high", createdById: 1 },
  ]);

  console.log("Done.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
