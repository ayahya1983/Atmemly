import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
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
    freelancer_profiles, client_profiles, users, skills, categories
    RESTART IDENTITY CASCADE`);

  const categories = [
    { slug: "design", nameEn: "Design & Creative", nameAr: "التصميم والإبداع" },
    { slug: "development", nameEn: "Web & Mobile Development", nameAr: "تطوير الويب والتطبيقات" },
    { slug: "writing", nameEn: "Writing & Translation", nameAr: "الكتابة والترجمة" },
    { slug: "marketing", nameEn: "Marketing & SEO", nameAr: "التسويق وتحسين محركات البحث" },
    { slug: "video", nameEn: "Video & Motion", nameAr: "الفيديو والموشن" },
    { slug: "consulting", nameEn: "Business Consulting", nameAr: "استشارات الأعمال" },
    { slug: "data", nameEn: "Data & Analytics", nameAr: "البيانات والتحليلات" },
    { slug: "support", nameEn: "Admin & Support", nameAr: "الدعم الإداري" },
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
      email: "admin@khidma.ae",
      passwordHash: adminPwd,
      fullName: "Khidma Admin",
      role: "admin",
      avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Khidma%20Admin&backgroundColor=458CCA",
    })
    .returning();
  void admin;

  const clientsData = [
    {
      email: "noor@nooragency.ae",
      fullName: "Noor Al Hashimi",
      companyName: "Noor Creative Agency",
      overview: "A Dubai-based creative agency working with regional brands across the Gulf.",
      location: "Dubai, UAE",
    },
    {
      email: "saeed@gulftech.ae",
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
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.fullName)}&backgroundColor=458CCA`,
      })
      .returning();
    await db.insert(clientProfilesTable).values({
      userId: u!.id,
      companyName: c.companyName,
      overview: c.overview,
      location: c.location,
      logoUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(c.companyName)}&backgroundColor=458CCA`,
    });
    clients.push(u!);
  }

  const freelancersData = [
    {
      email: "layla@khidma.ae",
      fullName: "Layla Bin Saeed",
      headline: "Senior Brand & Identity Designer",
      bio: "10+ years crafting identities for regional and international brands. Based in Dubai, fluent in Arabic and English.",
      hourlyRate: 220,
      skills: ["Branding", "Logo Design", "Figma", "UI/UX"],
      location: "Dubai, UAE",
    },
    {
      email: "omar@khidma.ae",
      fullName: "Omar Al Saadi",
      headline: "Full-stack Developer (React + Node)",
      bio: "Building production web apps for fintech and e-commerce clients across the GCC.",
      hourlyRate: 280,
      skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL"],
      location: "Riyadh, KSA",
    },
    {
      email: "huda@khidma.ae",
      fullName: "Huda Mansour",
      headline: "Bilingual Copywriter & Content Strategist",
      bio: "I write punchy bilingual copy for brands that want to win Arabic-speaking audiences without losing their English voice.",
      hourlyRate: 180,
      skills: ["Arabic Copywriting", "English Copywriting", "Content Strategy", "Translation EN-AR"],
      location: "Amman, Jordan",
    },
    {
      email: "khalid@khidma.ae",
      fullName: "Khalid Al Farsi",
      headline: "Performance Marketer (Google + Meta)",
      bio: "I run profitable paid campaigns for D2C brands. AED 50M+ ad spend managed across the Gulf.",
      hourlyRate: 240,
      skills: ["Google Ads", "Meta Ads", "SEO", "Content Strategy"],
      location: "Doha, Qatar",
    },
    {
      email: "amal@khidma.ae",
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
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(f.fullName)}&backgroundColor=458CCA`,
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
      categorySlug: "writing",
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
      title: "Virtual assistant for inbox + calendar",
      description: "Part-time VA, Arabic and English. Manage exec inbox, calendar, and travel for a Dubai-based founder.",
      categorySlug: "support",
      budgetType: "hourly", budgetMin: 60, budgetMax: 110,
      skills: ["Virtual Assistance", "Project Management"],
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
      title: "Welcome to Khidma",
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
      titleAr: "شروط الخدمة",
      bodyEn:
        "These Terms of Service govern your access to and use of the Khidma platform, " +
        "a UAE-based marketplace for freelance services. By accessing or using Khidma you " +
        "agree to be bound by these terms, our Privacy Policy and applicable UAE laws " +
        "including the Federal Decree-Law No. 45 of 2021 on Personal Data Protection.",
      bodyAr:
        "تحكم شروط الخدمة هذه وصولك إلى منصة خدمة واستخدامك لها، وهي منصة مقرها الإمارات " +
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
        "Khidma collects only the personal data needed to operate the marketplace: account " +
        "information, profile details, payment records and communications. Data is stored " +
        "securely and is not shared with third parties except as required to provide the " +
        "service or as required by UAE law.",
      bodyAr:
        "تجمع منصة خدمة البيانات الشخصية اللازمة فقط لتشغيل السوق: معلومات الحساب وتفاصيل " +
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
        "All briefs, files and communications exchanged on Khidma are considered confidential " +
        "between the contracting parties. Sharing client material outside the engagement " +
        "without written consent is prohibited.",
      bodyAr:
        "تعتبر جميع الملفات والمراسلات المتبادلة على منصة خدمة سرية بين الأطراف المتعاقدة. " +
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
      value: "support@khidma.ae",
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
  ]);

  console.log("Done.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
