#!/usr/bin/env node
import { io as ioClient } from "socket.io-client";

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? " — " + detail : ""}`);
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
  if (raw) return { res, json, text };
  return { status: res.status, json, headers: res.headers };
}

async function login(email, password) {
  const r = await api("POST", "/auth/login", { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.json)}`);
  return { token: r.json.token, user: r.json.user };
}

(async () => {
  // ---- 1. Login as admin, client, freelancer ----
  const admin = await login("admin@khidma.ae", "admin1234");
  check("login admin", !!admin.token);
  const client = await login("noor@nooragency.ae", "client1234");
  check("login client", !!client.token);
  const fl = await login("layla@khidma.ae", "freelancer1234");
  check("login freelancer", !!fl.token);

  // ---- 2. Public settings ----
  const pub = await api("GET", "/settings/public");
  check(
    "GET /settings/public returns platform_fee_pct=10",
    pub.status === 200 && pub.json?.platform_fee_pct === 10,
    `keys=${Object.keys(pub.json ?? {}).join(",")}`,
  );

  // ---- 3. Legal docs ----
  const terms = await api("GET", "/legal/terms?lang=en");
  check(
    "GET /legal/terms (en)",
    terms.status === 200 && typeof terms.json?.body === "string",
    `version=${terms.json?.version}`,
  );
  const termsAr = await api("GET", "/legal/terms?lang=ar");
  check(
    "GET /legal/terms (ar) returns Arabic body",
    termsAr.status === 200 && /[\u0600-\u06FF]/.test(termsAr.json?.body ?? ""),
  );

  // ---- 4. Consent record ----
  const consentRes = await api("POST", "/consents", {
    token: client.token,
    body: { documentSlug: "terms" },
  });
  check(
    "POST /consents records acceptance",
    consentRes.status === 200 && consentRes.json?.documentSlug === "terms",
  );
  const myConsents = await api("GET", "/me/consents", { token: client.token });
  check(
    "GET /me/consents lists",
    myConsents.status === 200 && Array.isArray(myConsents.json) && myConsents.json.length >= 1,
  );

  // ---- 5. Notifications ----
  const unread = await api("GET", "/notifications/unread-count", { token: fl.token });
  check(
    "GET /notifications/unread-count",
    unread.status === 200 && typeof unread.json?.count === "number",
    `count=${unread.json?.count}`,
  );
  const list = await api("GET", "/notifications", { token: fl.token });
  check("GET /notifications list", list.status === 200 && Array.isArray(list.json));
  if (Array.isArray(list.json) && list.json.length > 0) {
    const id = list.json[0].id;
    const read = await api("PATCH", `/notifications/${id}/read`, { token: fl.token });
    check(`PATCH /notifications/${id}/read`, read.status === 200);
  }

  // ---- 6. Search ranking ----
  const jobsNew = await api("GET", "/jobs?sort=newest&limit=5");
  check(
    "GET /jobs?sort=newest&limit=5",
    jobsNew.status === 200 && Array.isArray(jobsNew.json) && jobsNew.json.length <= 5,
    `n=${jobsNew.json?.length}`,
  );
  const jobsBudget = await api("GET", "/jobs?sort=budget_high&limit=3");
  check(
    "GET /jobs?sort=budget_high",
    jobsBudget.status === 200 && Array.isArray(jobsBudget.json),
  );
  const flList = await api("GET", "/freelancers?sort=relevance&limit=5");
  check(
    "GET /freelancers?sort=relevance",
    flList.status === 200 && Array.isArray(flList.json),
    `n=${flList.json?.length}`,
  );
  const flRating = await api("GET", "/freelancers?sort=rating&limit=5");
  check("GET /freelancers?sort=rating", flRating.status === 200);
  const flRateLow = await api("GET", "/freelancers?sort=rate_low&limit=5");
  check("GET /freelancers?sort=rate_low", flRateLow.status === 200);

  // ---- 7. Reviews require completed contract ----
  // Pick any job + post a review without an actual completed contract — should 403.
  const someJob = jobsNew.json?.[0];
  if (someJob) {
    const badReview = await api("POST", "/reviews", {
      token: client.token,
      body: { jobId: someJob.id, toUserId: fl.user.id, rating: 5, comment: "Nice" },
    });
    check(
      "POST /reviews without completed contract → rejected",
      badReview.status === 403 || badReview.status === 400,
      `status=${badReview.status}`,
    );
  }
  const summary = await api("GET", `/reviews/summary?userId=${fl.user.id}`);
  check(
    "GET /reviews/summary",
    summary.status === 200 && typeof summary.json?.ratingCount === "number",
    `ratingCount=${summary.json?.ratingCount} avg=${summary.json?.ratingAvg}`,
  );

  // ---- 8. Disputes lifecycle ----
  // Need a contract where client+freelancer match. Query /me/contracts as client.
  const myContracts = await api("GET", "/contracts", { token: client.token });
  let contractId = null;
  if (Array.isArray(myContracts.json) && myContracts.json.length > 0) {
    contractId = myContracts.json[0].id;
  }
  if (contractId) {
    const dispute = await api("POST", `/contracts/${contractId}/disputes`, {
      token: client.token,
      body: {
        kind: "quality",
        subject: "Smoke test dispute",
        description: "Automated smoke test dispute body — please ignore.",
      },
    });
    check(
      `POST /contracts/${contractId}/disputes`,
      dispute.status === 200 && dispute.json?.id,
      `id=${dispute.json?.id}`,
    );
    if (dispute.json?.id) {
      const did = dispute.json.id;
      const myDisputes = await api("GET", "/disputes", { token: client.token });
      check(
        "GET /disputes (mine)",
        myDisputes.status === 200 && myDisputes.json?.some((d) => d.id === did),
      );
      const msgPost = await api("POST", `/disputes/${did}/messages`, {
        token: client.token,
        body: { body: "Adding details from client side." },
      });
      check(`POST /disputes/${did}/messages`, msgPost.status === 200);
      const msgs = await api("GET", `/disputes/${did}/messages`, { token: client.token });
      check(
        `GET /disputes/${did}/messages`,
        msgs.status === 200 && Array.isArray(msgs.json) && msgs.json.length >= 1,
      );
      const adminList = await api("GET", "/admin/disputes", { token: admin.token });
      check(
        "GET /admin/disputes",
        adminList.status === 200 && Array.isArray(adminList.json),
      );
      const adminPatch = await api("PATCH", `/admin/disputes/${did}`, {
        token: admin.token,
        body: { status: "resolved", resolutionNotes: "Closed via smoke test." },
      });
      check(
        `PATCH /admin/disputes/${did} → resolved`,
        adminPatch.status === 200 && adminPatch.json?.status === "resolved",
      );
    }
  } else {
    console.log("[SKIP] disputes lifecycle — no contracts found for client");
  }

  // ---- 9. Admin analytics ----
  const overview = await api("GET", "/admin/analytics/overview", { token: admin.token });
  check(
    "GET /admin/analytics/overview",
    overview.status === 200 && overview.json && typeof overview.json === "object",
    `keys=${Object.keys(overview.json ?? {}).join(",")}`,
  );
  const ts = await api("GET", "/admin/analytics/timeseries?metric=signups&days=14", {
    token: admin.token,
  });
  check(
    "GET /admin/analytics/timeseries",
    ts.status === 200 && Array.isArray(ts.json?.points) && ts.json.points.length === 14,
    `points=${ts.json?.points?.length}`,
  );
  const topCats = await api("GET", "/admin/analytics/top-categories", { token: admin.token });
  check("GET /admin/analytics/top-categories", topCats.status === 200);
  const topFls = await api("GET", "/admin/analytics/top-freelancers", { token: admin.token });
  check("GET /admin/analytics/top-freelancers", topFls.status === 200);

  // ---- 10. Audit logs filters + CSV ----
  const audit = await api(
    "GET",
    "/admin/audit-logs?action=user.login&limit=10",
    { token: admin.token },
  );
  check(
    "GET /admin/audit-logs?action=user.login",
    audit.status === 200 && Array.isArray(audit.json),
    `rows=${audit.json?.length}`,
  );
  const csvRes = await fetch(`${BASE}/api/admin/audit-logs.csv?limit=5`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  const csvText = await csvRes.text();
  check(
    "GET /admin/audit-logs.csv",
    csvRes.status === 200 && csvText.split("\n")[0]?.includes("id,"),
    `bytes=${csvText.length}`,
  );

  // ---- 11. File upload ----
  const fd = new FormData();
  const blob = new Blob(["smoke-test content " + Date.now()], { type: "text/plain" });
  fd.append("file", blob, "smoke.txt");
  fd.append("kind", "test");
  const upRes = await fetch(`${BASE}/api/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${client.token}` },
    body: fd,
  });
  const upJson = await upRes.json().catch(() => ({}));
  check(
    "POST /uploads (text/plain)",
    upRes.status === 200 && upJson?.url && upJson?.sha256,
    `id=${upJson?.id} url=${upJson?.url}`,
  );
  if (upJson?.url) {
    const dl = await fetch(`${BASE}${upJson.url}`);
    const body = await dl.text();
    check(
      `GET ${upJson.url} (download)`,
      dl.status === 200 && body.startsWith("smoke-test"),
      `bytes=${body.length}`,
    );
  }

  // ---- 12. Platform settings admin update ----
  const setUpdate = await api("PUT", "/admin/settings/platform_fee_pct", {
    token: admin.token,
    body: { value: 10 },
  });
  check(
    "PUT /admin/settings/platform_fee_pct",
    setUpdate.status === 200,
    `status=${setUpdate.status}`,
  );

  // ---- 13. Socket.IO connect & receive ----
  await new Promise((resolve) => {
    const socket = ioClient(BASE, {
      path: "/api/socket.io",
      auth: { token: fl.token },
      transports: ["websocket", "polling"],
      reconnection: false,
      timeout: 5000,
    });
    let gotEvent = false;
    socket.on("connect", async () => {
      check("socket.io connect", true, `id=${socket.id}`);
      // Trigger a notification by creating a dispute message? Simpler: have admin post
      // a global notification — but we don't have that endpoint. Instead, simulate by
      // creating another consent which won't notify. Use disputes message if dispute exists.
      setTimeout(() => {
        check("socket.io stayed connected 1s", socket.connected);
        socket.close();
        resolve();
      }, 1500);
    });
    socket.on("notification:new", () => {
      gotEvent = true;
    });
    socket.on("connect_error", (err) => {
      check("socket.io connect", false, err.message);
      socket.close();
      resolve();
    });
  });

  // ---- Summary ----
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== Smoke summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log("Failures:");
    for (const r of results.filter((r) => !r.ok)) console.log(`  - ${r.name} ${r.detail}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(2);
});
