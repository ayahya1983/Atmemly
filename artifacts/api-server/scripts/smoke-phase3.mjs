#!/usr/bin/env node
// Phase 3 smoke — exercises scoring, recommendations, saved searches,
// admin reporting, SEO/public endpoints, healthz/readyz, security headers,
// and the rate-limit baseline. Pairs with smoke-phase2.mjs.

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
}

async function api(method, path, { token, body, raw } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (raw) return { res, text, json };
  return { status: res.status, json, headers: res.headers };
}

async function login(email, password) {
  const r = await api("POST", "/auth/login", { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, user: r.json.user };
}

(async () => {
  // ---- 1. Logins ----
  const admin = await login("admin@atmemly.com", "admin1234");
  check("login admin", !!admin.token);
  const client = await login("noor@atmemly.com", "client1234");
  check("login client", !!client.token);
  const fl = await login("layla@atmemly.com", "freelancer1234");
  check("login freelancer", !!fl.token);

  // ---- 2. Health / readiness ----
  const hz = await api("GET", "/healthz");
  check("GET /healthz", hz.status === 200 && hz.json?.status === "ok");
  const rz = await api("GET", "/readyz");
  check("GET /readyz", rz.status === 200 && rz.json?.status === "ready", `db=${rz.json?.db}`);

  // ---- 3. Security headers + request id ----
  const headOk =
    hz.headers.get("x-content-type-options") === "nosniff" &&
    !!hz.headers.get("x-request-id");
  check("Security headers + X-Request-Id", headOk);

  // ---- 4. Localized categories ----
  const catsEn = await api("GET", "/meta/categories?lang=en");
  const catsAr = await api("GET", "/meta/categories?lang=ar");
  check(
    "GET /meta/categories?lang=en returns localized name",
    catsEn.status === 200 && Array.isArray(catsEn.json) && catsEn.json[0]?.name === catsEn.json[0]?.nameEn,
  );
  check(
    "GET /meta/categories?lang=ar returns Arabic name",
    catsAr.status === 200 && Array.isArray(catsAr.json) && catsAr.json[0]?.name === catsAr.json[0]?.nameAr,
  );

  // ---- 5. Public categories (cached) ----
  const pubCats = await api("GET", "/public/categories?lang=ar");
  check("GET /public/categories?lang=ar", pubCats.status === 200 && Array.isArray(pubCats.json));

  // ---- 6. Sitemap + robots ----
  const sm = await fetch(`${BASE}/api/sitemap.xml`);
  const smText = await sm.text();
  check(
    "GET /sitemap.xml returns XML with urlset",
    sm.status === 200 && smText.includes("<urlset"),
  );
  const robots = await fetch(`${BASE}/api/robots.txt`);
  const robotsText = await robots.text();
  check(
    "GET /robots.txt has Sitemap directive",
    robots.status === 200 && /Sitemap:/i.test(robotsText),
  );

  // ---- 7. Public job + freelancer SEO endpoints ----
  // Pick a real job id by listing jobs as a fallback
  const jobsList = await api("GET", "/jobs?limit=1");
  const sampleJobId = Array.isArray(jobsList.json?.items)
    ? jobsList.json.items[0]?.id
    : Array.isArray(jobsList.json)
      ? jobsList.json[0]?.id
      : null;
  if (sampleJobId) {
    const pj = await api("GET", `/public/jobs/${sampleJobId}`);
    check("GET /public/jobs/:id has seo block", pj.status === 200 && !!pj.json?.seo?.title);
  } else {
    check("GET /public/jobs/:id (no jobs in DB)", true, "skipped");
  }
  const pf = await api("GET", `/public/freelancers/${fl.user.id}`);
  check("GET /public/freelancers/:id", pf.status === 200 && pf.json?.id === fl.user.id);

  // ---- 8. Scoring recompute ----
  const recomputeAll = await api("POST", "/admin/scoring/recompute-all", { token: admin.token });
  check(
    "POST /admin/scoring/recompute-all",
    recomputeAll.status === 200 &&
      typeof recomputeAll.json?.freelancers === "number" &&
      typeof recomputeAll.json?.clients === "number",
    `f=${recomputeAll.json?.freelancers} c=${recomputeAll.json?.clients}`,
  );

  const trust = await api("GET", `/freelancers/${fl.user.id}/trust`);
  check(
    "GET /freelancers/:id/trust returns numeric score",
    trust.status === 200 && typeof trust.json?.trustScore === "number",
    `score=${trust.json?.trustScore}`,
  );
  const quality = await api("GET", `/clients/${client.user.id}/quality`);
  check(
    "GET /clients/:id/quality returns numeric score",
    quality.status === 200 && typeof quality.json?.qualityScore === "number",
    `score=${quality.json?.qualityScore}`,
  );

  // ---- 9. Recommendations ----
  const recJobs = await api("GET", "/me/recommended-jobs?limit=5", { token: fl.token });
  check(
    "GET /me/recommended-jobs (freelancer)",
    recJobs.status === 200 && Array.isArray(recJobs.json),
    `count=${Array.isArray(recJobs.json) ? recJobs.json.length : "?"}`,
  );
  const recFls = await api("GET", "/me/recommended-freelancers?limit=5", { token: client.token });
  check(
    "GET /me/recommended-freelancers (client)",
    recFls.status === 200 && Array.isArray(recFls.json),
    `count=${Array.isArray(recFls.json) ? recFls.json.length : "?"}`,
  );
  const sim = await api("GET", `/freelancers/${fl.user.id}/similar?limit=5`);
  check("GET /freelancers/:id/similar", sim.status === 200 && Array.isArray(sim.json));

  // Job-specific matches as the owning client
  if (sampleJobId) {
    const m = await api("GET", `/jobs/${sampleJobId}/matches`, { token: client.token });
    check(
      "GET /jobs/:id/matches as client owner OR forbidden 403",
      m.status === 200 || m.status === 403 || m.status === 404,
      `status=${m.status}`,
    );
    const mUnauth = await api("GET", `/jobs/${sampleJobId}/matches`, { token: fl.token });
    check(
      "GET /jobs/:id/matches as non-owner is 403",
      mUnauth.status === 403,
      `status=${mUnauth.status}`,
    );
  }

  // ---- 10. Saved searches CRUD + sweep ----
  const created = await api("POST", "/me/saved-searches", {
    token: fl.token,
    body: { name: "Logo design jobs", query: { q: "logo", category: null }, notify: true },
  });
  check("POST /me/saved-searches", created.status === 200 && typeof created.json?.id === "number");
  const ssId = created.json?.id;

  const list = await api("GET", "/me/saved-searches", { token: fl.token });
  check(
    "GET /me/saved-searches",
    list.status === 200 && Array.isArray(list.json) && list.json.some((s) => s.id === ssId),
  );

  const preview = await api("GET", `/me/saved-searches/${ssId}/preview`, { token: fl.token });
  check(
    "GET /me/saved-searches/:id/preview",
    preview.status === 200 && Array.isArray(preview.json),
    `matched=${preview.json?.length ?? 0}`,
  );

  const sweep = await api("POST", "/admin/saved-searches/run", { token: admin.token });
  check(
    "POST /admin/saved-searches/run",
    sweep.status === 200 && typeof sweep.json?.searchesScanned === "number",
    `scanned=${sweep.json?.searchesScanned} new=${sweep.json?.matchesNew}`,
  );

  const del = await api("DELETE", `/me/saved-searches/${ssId}`, { token: fl.token });
  check("DELETE /me/saved-searches/:id", del.status === 200 && del.json?.ok === true);

  // ---- 11. Admin reports ----
  const rev = await api("GET", "/admin/reports/revenue", { token: admin.token });
  check("GET /admin/reports/revenue", rev.status === 200 && typeof rev.json?.gmv === "number");
  const payouts = await api("GET", "/admin/reports/payouts", { token: admin.token });
  check("GET /admin/reports/payouts", payouts.status === 200 && Array.isArray(payouts.json?.byStatus));
  const cohorts = await api("GET", "/admin/reports/cohorts?metric=signups&months=3", { token: admin.token });
  check("GET /admin/reports/cohorts (signups)", cohorts.status === 200 && Array.isArray(cohorts.json?.rows));
  const cohortsFc = await api("GET", "/admin/reports/cohorts?metric=first_contract&months=3", { token: admin.token });
  check(
    "GET /admin/reports/cohorts (first_contract)",
    cohortsFc.status === 200 && Array.isArray(cohortsFc.json?.rows),
  );
  const tc = await api("GET", "/admin/reports/top-clients", { token: admin.token });
  check("GET /admin/reports/top-clients", tc.status === 200 && Array.isArray(tc.json));
  const tf = await api("GET", "/admin/reports/top-freelancers", { token: admin.token });
  check("GET /admin/reports/top-freelancers", tf.status === 200 && Array.isArray(tf.json));
  const fn = await api("GET", "/admin/reports/funnel", { token: admin.token });
  check(
    "GET /admin/reports/funnel",
    fn.status === 200 && typeof fn.json?.signups === "number",
    `signups=${fn.json?.signups} completed=${fn.json?.completedContracts}`,
  );

  // ---- 12. Reports require admin role ----
  const revForbidden = await api("GET", "/admin/reports/revenue", { token: client.token });
  check("Reports forbidden for non-admin", revForbidden.status === 403);

  // ---- 13. JSON body limit ----
  const big = "x".repeat(2 * 1024 * 1024); // 2 MB
  const tooBig = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@b.c", password: big }),
  });
  check("Body > 1 MB rejected (413)", tooBig.status === 413, `status=${tooBig.status}`);

  // ---- 14. Match diagnostic endpoint ----
  if (sampleJobId) {
    const md = await api("GET", `/match/jobs/${sampleJobId}/freelancers/${fl.user.id}`, {
      token: admin.token,
    });
    check(
      "GET /match/jobs/:jobId/freelancers/:freelancerId (admin)",
      md.status === 200 && typeof md.json?.total === "number" && !!md.json?.components,
      `total=${md.json?.total}`,
    );
    const mdNonAdmin = await api(
      "GET",
      `/match/jobs/${sampleJobId}/freelancers/${fl.user.id}`,
      { token: client.token },
    );
    check(
      "GET /match diagnostic forbidden for non-admin (403)",
      mdNonAdmin.status === 403,
      `status=${mdNonAdmin.status}`,
    );
  }

  // ---- Summary ----
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed (${failed.length} failed)`,
  );
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) console.log(` - ${f.name}${f.detail ? " :: " + f.detail : ""}`);
    process.exit(1);
  }
})().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
