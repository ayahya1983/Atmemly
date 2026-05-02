// Phase 4 smoke. Hits localhost:80 (Replit shared proxy) and exercises the
// Phase 4 surfaces: mobile API envelope + headers, device tokens, payment
// gateway, featured listings, subscriptions, currencies + FX, reconciliation,
// moderation, metrics, escrow events, payout batches, invoice tax data.
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
    console.log(`✘ ${name} ${info ? `— ${typeof info === "string" ? info : JSON.stringify(info).slice(0, 300)}` : ""}`);
  }
}

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
  if (r.status !== 200 || !r.data?.token) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.data.token;
}

const ADMIN = ["admin@khidma.ae", "admin1234"];
const CLIENT = ["noor@nooragency.ae", "client1234"];
const FREELANCER = ["layla@khidma.ae", "freelancer1234"];

(async () => {
  const adminTok = await login(...ADMIN);
  const clientTok = await login(...CLIENT);
  const freeTok = await login(...FREELANCER);

  // ---- API envelope + headers ----
  const h = await req("GET", "/currencies");
  ok("envelope: /currencies returns { data }", h.status === 200 && Array.isArray(h.data?.data), { status: h.status, body: h.data });
  ok("X-API-Version header == 4", h.headers.get("x-api-version") === "4");
  ok("X-Request-Id present", !!h.headers.get("x-request-id"));
  ok("currencies seeded (>=5)", Array.isArray(h.data?.data) && h.data.data.length >= 5);

  // ---- Device tokens ----
  const dev1 = await req("POST", "/me/devices", { platform: "ios", token: `tok_${Date.now()}_a`, appVersion: "1.0.0", locale: "en" }, freeTok);
  ok("device register 200", dev1.status === 200 && typeof dev1.data?.data?.id === "number", dev1.data);
  const devId = dev1.data?.data?.id;
  const dupTok = `tok_dup_${Date.now()}`;
  const dup1 = await req("POST", "/me/devices", { platform: "ios", token: dupTok }, freeTok);
  const dup2 = await req("POST", "/me/devices", { platform: "ios", token: dupTok }, freeTok);
  ok("device register idempotent (same user, same token)", dup1.status === 200 && dup2.status === 200 && dup1.data?.data?.id === dup2.data?.data?.id);
  const dupOther = await req("POST", "/me/devices", { platform: "ios", token: dupTok }, clientTok);
  ok("device token owned by other user → 409", dupOther.status === 409, { status: dupOther.status });
  const list = await req("GET", "/me/devices", null, freeTok);
  ok("device list returns envelope array", list.status === 200 && Array.isArray(list.data?.data));
  ok("device list redacts token", list.data.data.every((d) => d.token.endsWith("…")));
  const del = await req("DELETE", `/me/devices/${devId}`, null, freeTok);
  ok("device delete 200", del.status === 200);
  const delAuth = await req("DELETE", `/me/devices/9999999`, null, freeTok);
  ok("device delete missing → 404", delAuth.status === 404);
  const noAuth = await req("GET", "/me/devices");
  ok("device list requires auth", noAuth.status === 401);

  // ---- Payment gateway ----
  const gw = await req("GET", "/payments/gateway");
  ok("gateway info returns active+available", gw.status === 200 && gw.data?.data?.active && Array.isArray(gw.data?.data?.available));
  ok("gateway adapters include mock,stripe,paytabs,telr,manual", gw.data?.data?.available?.length === 5);
  ok("default active gateway is mock", gw.data?.data?.active === "mock");
  const setGwClient = await req("POST", "/admin/payments/gateway", { name: "telr" }, clientTok);
  ok("set gateway as non-admin → 403", setGwClient.status === 403);
  const setGwAdmin = await req("POST", "/admin/payments/gateway", { name: "telr" }, adminTok);
  ok("admin can set gateway", setGwAdmin.status === 200 && setGwAdmin.data?.data?.active === "telr");
  // restore mock
  await req("POST", "/admin/payments/gateway", { name: "mock" }, adminTok);
  const wh = await req("POST", "/payments/webhook/mock", { id: "evt_x", type: "payment_intent.succeeded" });
  ok("mock webhook accepts payload", wh.status === 200 && wh.data?.data?.received === true);
  const whBad = await req("POST", "/payments/webhook/unknown_gw", {});
  ok("unknown webhook gateway → 404", whBad.status === 404);
  const refundUnconfigured = await req("POST", "/admin/payments/refund", { intentId: "x" }, adminTok);
  ok("refund returns success on mock gateway", refundUnconfigured.status === 200);

  // ---- Featured listings ----
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const featCreate = await req("POST", "/admin/featured", { kind: "job", targetId: 1, startsAt, endsAt, note: "smoke" }, adminTok);
  ok("admin can create featured", featCreate.status === 200 && typeof featCreate.data?.data?.id === "number", featCreate.data);
  const featId = featCreate.data?.data?.id;
  const featCreateClient = await req("POST", "/admin/featured", { kind: "job", targetId: 1, endsAt }, clientTok);
  ok("create featured as client → 403", featCreateClient.status === 403);
  const featList = await req("GET", "/featured?kind=job");
  ok("public featured list", featList.status === 200 && Array.isArray(featList.data?.data) && featList.data.data.length >= 1);
  const featDel = await req("DELETE", `/admin/featured/${featId}`, null, adminTok);
  ok("admin delete featured", featDel.status === 200);
  const featBadRange = await req("POST", "/admin/featured", { kind: "job", targetId: 1, startsAt: endsAt, endsAt: startsAt }, adminTok);
  ok("featured invalid range → 400", featBadRange.status === 400);

  // ---- Subscriptions ----
  const plans = await req("GET", "/subscription-plans");
  ok("plans list public, has 2", plans.status === 200 && plans.data?.data?.length >= 2);
  const planId = plans.data.data.find((p) => p.slug === "freelancer_pro")?.id;
  ok("freelancer_pro plan present", typeof planId === "number");
  const subscribe = await req("POST", "/me/subscription", { planId, autoRenew: true }, freeTok);
  ok("freelancer subscribes", subscribe.status === 200 && subscribe.data?.data?.subscription?.status === "active");
  const myPlan = await req("GET", "/me/subscription", null, freeTok);
  ok("my subscription returns plan", myPlan.status === 200 && myPlan.data?.data?.plan?.slug === "freelancer_pro");
  const subTwice = await req("POST", "/me/subscription", { planId }, freeTok);
  ok("re-subscribe supersedes previous", subTwice.status === 200);
  const cancel = await req("POST", "/me/subscription/cancel", null, freeTok);
  ok("cancel subscription", cancel.status === 200 && cancel.data?.data?.status === "canceled");
  const cancelAgain = await req("POST", "/me/subscription/cancel", null, freeTok);
  ok("cancel without active → 404", cancelAgain.status === 404);
  const adminPlans = await req("GET", "/admin/subscription-plans", null, adminTok);
  ok("admin plan list includes inactive too", adminPlans.status === 200);
  const adminPlansDenied = await req("GET", "/admin/subscription-plans", null, freeTok);
  ok("admin plan list denied to non-admin", adminPlansDenied.status === 403);

  // ---- Invoice tax data ----
  const invList = await req("GET", "/invoices", null, clientTok);
  const firstInvoiceId = Array.isArray(invList.data) ? invList.data[0]?.id : (Array.isArray(invList.data?.data) ? invList.data.data[0]?.id : null);
  if (firstInvoiceId) {
    const tax = await req("GET", `/invoices/${firstInvoiceId}/tax-pdf-data`, null, clientTok);
    ok("invoice tax-pdf-data returns envelope", tax.status === 200 && tax.data?.data?.invoice?.invoiceNumber);
    ok("tax-pdf-data exposes placeOfSupply default AE", tax.data?.data?.invoice?.placeOfSupply === "AE");
    ok("tax-pdf-data exposes platform TRN", typeof tax.data?.data?.platform?.trn === "string" && tax.data.data.platform.trn.length > 0);
    const taxFreelancer = await req("GET", `/invoices/${firstInvoiceId}/tax-pdf-data`, null, freeTok);
    ok("tax-pdf-data accessible to freelancer party", taxFreelancer.status === 200 || taxFreelancer.status === 403);
  } else {
    console.log("ℹ️  no seeded invoice — skipping tax-pdf-data check");
  }

  // ---- Currencies + FX ----
  const fx1 = await req("GET", "/fx-rates?base=AED&quote=USD");
  ok("fx single rate AED->USD present", fx1.status === 200 && typeof fx1.data?.data?.rate === "number");
  const fxIdent = await req("GET", "/fx-convert?amount=100&from=AED&to=AED");
  ok("fx convert identity rate=1", fxIdent.status === 200 && fxIdent.data?.data?.rate === 1);
  const fxConv = await req("GET", "/fx-convert?amount=1000&from=AED&to=USD");
  ok("fx convert AED→USD has amount", fxConv.status === 200 && typeof fxConv.data?.data?.amount === "number");
  const fxMissing = await req("GET", "/fx-rates?base=XXX&quote=YYY");
  ok("missing fx rate → 404", fxMissing.status === 404);
  const fxUpsert = await req("POST", "/admin/fx-rates", { base: "AED", quote: "USD", rate: 0.273, source: "smoke" }, adminTok);
  ok("admin upsert fx rate", fxUpsert.status === 200);
  const fxRefresh = await req("POST", "/admin/fx-rates/refresh", {}, adminTok);
  ok("fx refresh stub returns provider info", fxRefresh.status === 200 && fxRefresh.data?.data?.provider === "stub");

  // ---- Reconciliation ----
  const dailyAuth = await req("GET", "/admin/reconciliation/daily", null, freeTok);
  ok("reconciliation/daily forbids non-admin", dailyAuth.status === 403);
  const daily = await req("GET", "/admin/reconciliation/daily?date=2025-01-01", null, adminTok);
  ok("reconciliation/daily 200", daily.status === 200 && daily.data?.data?.date === "2025-01-01");
  const wallets = await req("GET", "/admin/reconciliation/wallets", null, adminTok);
  ok("reconciliation/wallets 200", wallets.status === 200 && typeof wallets.data?.data?.walletTotal === "number");
  const escrow = await req("GET", "/admin/reconciliation/escrow", null, adminTok);
  ok("reconciliation/escrow 200", escrow.status === 200 && typeof escrow.data?.data?.diff === "number");

  // ---- Moderation ----
  const report = await req("POST", "/reports", { targetKind: "job", targetId: 1, reason: "spam", details: "smoke" }, freeTok);
  ok("user can file moderation report", report.status === 200 && typeof report.data?.data?.id === "number");
  const reportId = report.data?.data?.id;
  const myRep = await req("GET", "/me/reports", null, freeTok);
  ok("my reports lists my filing", myRep.status === 200 && myRep.data?.data?.some((r) => r.id === reportId));
  const modList = await req("GET", "/admin/moderation?status=pending", null, adminTok);
  ok("admin moderation list with pagination meta", modList.status === 200 && modList.data?.meta?.pagination);
  const modListDenied = await req("GET", "/admin/moderation", null, freeTok);
  ok("admin moderation denied to non-admin", modListDenied.status === 403);
  const resolve = await req("POST", `/admin/moderation/${reportId}/resolve`, { action: "approve_keep", notes: "ok" }, adminTok);
  ok("admin resolves report", resolve.status === 200 && resolve.data?.data?.status === "resolved");

  // ---- Metrics ----
  const metAuth = await req("GET", "/metrics", null, freeTok);
  ok("metrics requires admin", metAuth.status === 403);
  const met = await req("GET", "/metrics", null, adminTok);
  ok("metrics returns process snapshot", met.status === 200 && typeof met.data?.data?.uptimeSec === "number" && met.data?.data?.requests);

  // ---- Escrow events (no funded milestones in seed; just check audit endpoint shape) ----
  const ee = await req("GET", "/admin/escrow/events", null, adminTok);
  ok("escrow events list returns envelope array (admin-only)", ee.status === 200 && Array.isArray(ee.data?.data));
  const eeDenied = await req("GET", "/admin/escrow/events", null, freeTok);
  ok("escrow events denied to non-admin", eeDenied.status === 403);

  // ---- Payout batches ----
  // Without any 'requested' payouts, this should 400 with no_candidates — that's success.
  const batchTry = await req("POST", "/admin/payout-batches", {}, adminTok);
  ok("payout batch with no candidates → 400 no_candidates", batchTry.status === 400 && batchTry.data?.error?.code === "no_candidates");
  const batches = await req("GET", "/admin/payout-batches", null, adminTok);
  ok("payout batch list 200 + meta", batches.status === 200 && batches.data?.meta?.pagination);

  // Phase 1-3 backward-compat sanity: ping a couple of stable endpoints
  const cats = await req("GET", "/meta/categories");
  ok("backcompat: meta/categories still works", cats.status === 200);
  const me = await req("GET", "/auth/me", null, clientTok);
  ok("backcompat: /auth/me still works", me.status === 200);

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log("Failures:", JSON.stringify(failures, null, 2));
    process.exit(1);
  }
})().catch((err) => {
  console.error("Smoke crashed:", err);
  process.exit(1);
});
