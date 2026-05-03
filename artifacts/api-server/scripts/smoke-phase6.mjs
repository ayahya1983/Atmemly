// Phase 6 smoke. Hits localhost:80 and exercises the admin control panel
// backend: dashboard, users v2, freelancer/client/verifications, jobs/proposals/
// contracts admin, CMS pages + blocks, blog/FAQ/testimonials, notification
// broadcast, banned words, reports JSON+CSV, and permission boundary.
const BASE = "http://localhost:80/api";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, info) {
  if (cond) {
    passed++;
    console.log(`✔ ${name}`);
  } else {
    failed++;
    failures.push({ name, info });
    console.log(`✘ ${name} ${info ? `— ${typeof info === "string" ? info : JSON.stringify(info).slice(0, 400)}` : ""}`);
  }
}

async function req(method, path, body, token, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined && body !== null ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  const ct = res.headers.get("content-type") ?? "";
  let data = null;
  try {
    if (ct.includes("application/json")) data = await res.json();
    else data = await res.text();
  } catch {
    data = null;
  }
  return { status: res.status, headers: res.headers, data };
}

async function login(email, password) {
  const r = await req("POST", "/auth/login", { email, password });
  if (r.status !== 200 || !r.data?.token) throw new Error(`login failed for ${email}: ${r.status} ${JSON.stringify(r.data)}`);
  return { token: r.data.token, userId: r.data.user.id };
}

const ADMIN_CREDS = ["admin@khidma.ae", "admin1234"];
const CLIENT_CREDS = ["noor@nooragency.ae", "client1234"];
const FREELANCER_CREDS = ["layla@khidma.ae", "freelancer1234"];

(async () => {
  const admin = await login(...ADMIN_CREDS);
  const client = await login(...CLIENT_CREDS);
  const freelancer = await login(...FREELANCER_CREDS);

  // ───────────── Dashboard ─────────────
  {
    const r = await req("GET", "/admin/dashboard", null, admin.token);
    ok("dashboard responds 200", r.status === 200, r);
    ok(
      "dashboard has totals + revenue + timeline",
      r.data &&
        r.data.totals &&
        typeof r.data.totals.users === "number" &&
        r.data.revenue &&
        typeof r.data.revenue.totalPaid === "number" &&
        Array.isArray(r.data.timeline),
      r.data,
    );
    const r2 = await req("GET", "/admin/dashboard", null, admin.token);
    ok("dashboard cache returns same generatedAt", r2.data?.generatedAt === r.data?.generatedAt);
    const denied = await req("GET", "/admin/dashboard", null, client.token);
    ok("dashboard 403 for non-admin", denied.status === 403, denied);
  }

  // ───────────── Users v2 ─────────────
  let createdUserId;
  {
    // Sign up a throwaway user to exercise PATCH/DELETE/notes/reset.
    const email = `phase6-${Date.now()}@khidma.ae`;
    const sign = await req("POST", "/auth/register", {
      email,
      password: "P@ssword123",
      fullName: "Phase Six Tester",
      role: "freelancer",
    });
    ok("register throwaway user", sign.status === 200 || sign.status === 201, sign);
    createdUserId = sign.data?.user?.id;

    const search = await req("GET", `/admin/users/search?q=phase6&limit=10`, null, admin.token);
    ok("user search finds throwaway", search.status === 200 && search.data.items.some((u) => u.id === createdUserId), search);

    const detail = await req("GET", `/admin/users/${createdUserId}`, null, admin.token);
    ok("user detail returns counts", detail.status === 200 && detail.data.counts, detail);

    const patch = await req(
      "PATCH",
      `/admin/users/${createdUserId}`,
      { status: "suspended" },
      admin.token,
    );
    ok("user suspend ok", patch.status === 200 && patch.data.status === "suspended", patch);

    const selfDemote = await req(
      "PATCH",
      `/admin/users/${admin.userId}`,
      { role: "client" },
      admin.token,
    );
    ok("admin cannot self-demote role", selfDemote.status === 400, selfDemote);

    const selfAdminRole = await req(
      "PATCH",
      `/admin/users/${admin.userId}`,
      { adminRole: "moderator" },
      admin.token,
    );
    ok("admin cannot change own admin role", selfAdminRole.status === 400, selfAdminRole);

    const reset = await req("POST", `/admin/users/${createdUserId}/reset-password`, {}, admin.token);
    ok("reset password returns temp", reset.status === 200 && typeof reset.data.tempPassword === "string", reset);

    const noteAdd = await req("POST", `/admin/users/${createdUserId}/notes`, { body: "Watch for spam." }, admin.token);
    ok("note add ok", noteAdd.status === 201 && noteAdd.data.body, noteAdd);
    const noteList = await req("GET", `/admin/users/${createdUserId}/notes`, null, admin.token);
    ok("note list returns array", noteList.status === 200 && Array.isArray(noteList.data) && noteList.data.length >= 1, noteList);

    const del = await req("DELETE", `/admin/users/${createdUserId}`, null, admin.token);
    ok("soft-delete user", del.status === 200 && del.data.status === "deleted", del);
    const delSelf = await req("DELETE", `/admin/users/${admin.userId}`, null, admin.token);
    ok("admin cannot delete self", delSelf.status === 400, delSelf);
  }

  // ───────────── Freelancers / Clients / Verifications ─────────────
  {
    const list = await req("GET", "/admin/freelancers?limit=5", null, admin.token);
    ok("freelancer list ok", list.status === 200 && Array.isArray(list.data.items), list);
    const target = list.data.items.find((u) => u.userId !== admin.userId) ?? list.data.items[0];

    const trust = await req(
      "PATCH",
      `/admin/freelancers/${target.userId}/trust-score`,
      { delta: 5, reason: "Phase 6 smoke" },
      admin.token,
    );
    ok("trust-score adjust ok", trust.status === 200 && typeof trust.data.trustScore === "number", trust);

    const vis = await req(
      "PATCH",
      `/admin/freelancers/${target.userId}/visibility`,
      { hidden: false },
      admin.token,
    );
    ok("freelancer visibility ok", vis.status === 200, vis);

    const clients = await req("GET", "/admin/clients?limit=5", null, admin.token);
    ok("client list ok", clients.status === 200 && Array.isArray(clients.data.items), clients);
    const clientTarget = clients.data.items[0];
    if (clientTarget) {
      const verify = await req(
        "POST",
        `/admin/clients/${clientTarget.userId}/verify`,
        { decision: "approved" },
        admin.token,
      );
      ok("client verify approve", verify.status === 200, verify);
    }

    const v = await req("GET", "/admin/verifications?limit=5", null, admin.token);
    ok("verifications list ok", v.status === 200 && Array.isArray(v.data), v);
  }

  // ───────────── Jobs / Proposals / Contracts ─────────────
  {
    const search = await req("GET", "/admin/jobs/search?limit=5", null, admin.token);
    ok("job search ok", search.status === 200 && Array.isArray(search.data.items), search);
    const job = search.data.items[0];
    if (job) {
      const feat = await req("POST", `/admin/jobs/${job.id}/feature`, {}, admin.token);
      ok("job feature ok", feat.status === 200, feat);
      const pause = await req("POST", `/admin/jobs/${job.id}/pause`, {}, admin.token);
      ok("job pause ok", pause.status === 200 && pause.data.status === "paused", pause);
      const closeAct = await req("POST", `/admin/jobs/${job.id}/close`, {}, admin.token);
      ok("job close ok", closeAct.status === 200 && closeAct.data.status === "closed", closeAct);
    }

    const props = await req("GET", "/admin/proposals?limit=5", null, admin.token);
    ok("proposal admin list ok", props.status === 200 && Array.isArray(props.data.items), props);
    const prop = props.data.items[0];
    if (prop) {
      const hide = await req(
        "PATCH",
        `/admin/proposals/${prop.id}/visibility`,
        { hidden: true, reason: "Phase 6 smoke" },
        admin.token,
      );
      ok("proposal hide ok", hide.status === 200 && hide.data.status === "hidden", hide);
      const show = await req(
        "PATCH",
        `/admin/proposals/${prop.id}/visibility`,
        { hidden: false },
        admin.token,
      );
      ok("proposal unhide ok", show.status === 200 && show.data.status === "pending", show);
    }

    const contracts = await req("GET", "/admin/contracts/search?limit=5", null, admin.token);
    ok("contracts search ok", contracts.status === 200 && Array.isArray(contracts.data.items), contracts);
    const contract = contracts.data.items[0];
    if (contract) {
      const hold = await req("POST", `/admin/contracts/${contract.id}/hold`, {}, admin.token);
      ok("contract hold ok", hold.status === 200 && hold.data.status === "on_hold", hold);
    }
  }

  // ───────────── CMS Pages + Blocks ─────────────
  let pageId;
  {
    const slug = `smoke-page-${Date.now()}`;
    const create = await req(
      "POST",
      "/admin/cms/pages",
      { slug, locale: "en", title: "Smoke Page", body: "Hello.", isPublished: true },
      admin.token,
    );
    ok("cms page create ok", create.status === 201 && create.data.id, create);
    pageId = create.data.id;

    const dup = await req(
      "POST",
      "/admin/cms/pages",
      { slug, locale: "en", title: "Dup" },
      admin.token,
    );
    ok("cms page duplicate slug 409", dup.status === 409, dup);

    const pub = await req("GET", `/cms/pages/${slug}?locale=en`);
    ok("public cms page reachable when published", pub.status === 200 && pub.data.title === "Smoke Page", pub);

    const patch = await req("PATCH", `/admin/cms/pages/${pageId}`, { title: "Renamed" }, admin.token);
    ok("cms page rename ok", patch.status === 200 && patch.data.title === "Renamed", patch);

    const block = await req(
      "PUT",
      "/admin/cms/blocks",
      { key: `smoke_block_${Date.now()}`, locale: "en", body: "Block body." },
      admin.token,
    );
    ok("cms block upsert ok", block.status === 200 && block.data.id, block);

    const del = await req("DELETE", `/admin/cms/pages/${pageId}`, null, admin.token);
    ok("cms page delete ok", del.status === 200 && del.data.deleted === true, del);
  }

  // ───────────── Blog + FAQ + Testimonials ─────────────
  {
    const slug = `smoke-${Date.now()}`;
    const blog = await req(
      "POST",
      "/admin/blog",
      { slug, locale: "en", title: "Smoke Blog", excerpt: "x", body: "y", isPublished: true },
      admin.token,
    );
    ok("blog create ok", blog.status === 201 && blog.data.id, blog);
    const blogList = await req("GET", "/blog?locale=en");
    ok("public blog list ok", blogList.status === 200 && Array.isArray(blogList.data) && blogList.data.length >= 1, blogList);
    await req("DELETE", `/admin/blog/${blog.data.id}`, null, admin.token);

    const faq = await req(
      "POST",
      "/admin/faqs",
      { locale: "en", category: "smoke", question: "Q?", answer: "A.", sortOrder: 99 },
      admin.token,
    );
    ok("faq create ok", faq.status === 201 && faq.data.id, faq);
    const faqList = await req("GET", "/faqs?locale=en");
    ok("public faq list ok", faqList.status === 200 && Array.isArray(faqList.data) && faqList.data.length >= 1, faqList);
    await req("DELETE", `/admin/faqs/${faq.data.id}`, null, admin.token);

    const t = await req(
      "POST",
      "/admin/testimonials",
      { locale: "en", authorName: "Smoke", body: "Great", rating: 5 },
      admin.token,
    );
    ok("testimonial create ok", t.status === 201 && t.data.id, t);
    const tList = await req("GET", "/testimonials?locale=en");
    ok("public testimonial list ok", tList.status === 200 && Array.isArray(tList.data) && tList.data.length >= 1, tList);
    await req("DELETE", `/admin/testimonials/${t.data.id}`, null, admin.token);
  }

  // ───────────── Notification broadcast ─────────────
  {
    const b = await req(
      "POST",
      "/admin/notifications/broadcast",
      {
        audience: "freelancers",
        kind: "admin_broadcast",
        title: "Phase 6 smoke",
        body: "Please ignore.",
      },
      admin.token,
    );
    ok("broadcast ok with positive count", b.status === 200 && typeof b.data.count === "number" && b.data.count > 0, b);

    const userIdsB = await req(
      "POST",
      "/admin/notifications/broadcast",
      {
        audience: "user_ids",
        userIds: [freelancer.userId],
        kind: "admin_broadcast",
        title: "DM smoke",
        body: "Hello.",
      },
      admin.token,
    );
    ok("broadcast user_ids ok", userIdsB.status === 200 && userIdsB.data.count === 1, userIdsB);

    const denied = await req(
      "POST",
      "/admin/notifications/broadcast",
      { audience: "all", kind: "x", title: "x", body: "x" },
      client.token,
    );
    ok("broadcast 403 for non-admin", denied.status === 403, denied);
  }

  // ───────────── Banned words ─────────────
  {
    const w = `smokeword${Date.now()}`;
    const add = await req(
      "POST",
      "/admin/moderation/banned-words",
      { word: w, locale: "en", severity: "low" },
      admin.token,
    );
    ok("banned word add ok", add.status === 201 && add.data.id, add);
    const list = await req("GET", "/admin/moderation/banned-words", null, admin.token);
    ok("banned word list ok", list.status === 200 && list.data.some((x) => x.word === w), list);
    const del = await req(`DELETE`, `/admin/moderation/banned-words/${add.data.id}`, null, admin.token);
    ok("banned word delete ok", del.status === 200, del);
  }

  // ───────────── Reports + CSV ─────────────
  {
    const j = await req("GET", "/admin/reports/users-growth", null, admin.token);
    ok("users-growth json ok", j.status === 200 && Array.isArray(j.data.items), j);

    const csv = await req("GET", "/admin/reports/users-growth?format=csv", null, admin.token);
    ok(
      "users-growth csv ok",
      csv.status === 200 &&
        typeof csv.data === "string" &&
        csv.data.startsWith("bucket,role,count") &&
        csv.headers.get("content-type")?.includes("text/csv"),
      { status: csv.status, body: typeof csv.data === "string" ? csv.data.slice(0, 200) : csv.data },
    );

    const r2 = await req("GET", "/admin/reports/revenue-timeseries", null, admin.token);
    ok("revenue-timeseries json ok", r2.status === 200 && Array.isArray(r2.data.items), r2);
    const r2csv = await req("GET", "/admin/reports/revenue-timeseries?format=csv", null, admin.token);
    ok(
      "revenue-timeseries csv ok",
      r2csv.status === 200 &&
        typeof r2csv.data === "string" &&
        r2csv.data.startsWith("bucket,currency,total,count"),
      { status: r2csv.status, body: typeof r2csv.data === "string" ? r2csv.data.slice(0, 200) : r2csv.data },
    );
    const r3 = await req("GET", "/admin/reports/top-categories", null, admin.token);
    ok("top-categories json ok", r3.status === 200 && Array.isArray(r3.data.items), r3);
    // Sanity-check legacy endpoints (kept by reports.ts router, different shape).
    const r4 = await req("GET", "/admin/reports/revenue", null, admin.token);
    ok("legacy revenue endpoint reachable", r4.status === 200, r4);
    const r5 = await req("GET", "/admin/reports/top-freelancers", null, admin.token);
    ok("legacy top-freelancers endpoint reachable", r5.status === 200, r5);
    const r6 = await req("GET", "/admin/reports/top-clients", null, admin.token);
    ok("legacy top-clients endpoint reachable", r6.status === 200, r6);
  }

  // ───────────── Public CMS for seeded pages ─────────────
  {
    const about = await req("GET", "/cms/pages/about-us?locale=en");
    ok("seeded about-us page reachable", about.status === 200 && about.data.title === "About ATMEMLY", about);
    const blockEn = await req("GET", "/cms/blocks/homepage_hero?locale=en");
    ok("seeded homepage_hero block reachable", blockEn.status === 200 && blockEn.data.body, blockEn);
    const blockAr = await req("GET", "/cms/blocks/homepage_hero?locale=ar");
    ok("seeded homepage_hero block ar reachable", blockAr.status === 200, blockAr);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f.name}: ${typeof f.info === "string" ? f.info : JSON.stringify(f.info).slice(0, 400)}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
