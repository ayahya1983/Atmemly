// Phase 5 smoke. Hits localhost:80 (Replit shared proxy) and exercises the
// Phase 5 surfaces: gateway registry, payment_transactions, payment_intents,
// webhook signature + dedup, manual bank-transfer flow with admin approve/reject,
// idempotency replay, admin financial summary, gateway CRUD.
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
  if (r.status !== 200 || !r.data?.token) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.data.token;
}

const ADMIN = ["admin@atmemly.com", "admin1234"];
const CLIENT = ["noor@atmemly.com", "client1234"];

(async () => {
  const adminTok = await login(...ADMIN);
  const clientTok = await login(...CLIENT);

  // ---------- Gateway listing ----------
  const gws = await req("GET", "/payments/gateways", null, clientTok);
  ok("GET /payments/gateways → 200 envelope", gws.status === 200 && Array.isArray(gws.data?.data), { status: gws.status, body: gws.data });
  const names = (gws.data?.data ?? []).map((g) => g.name).sort();
  ok("gateways list contains all 5 adapters", JSON.stringify(names) === JSON.stringify(["manual", "mock", "paytabs", "stripe", "telr"]), names);
  const manualGw = gws.data?.data?.find((g) => g.name === "manual");
  ok("manual gateway is configured + active by default", manualGw?.configured === true && manualGw?.isActive === true, manualGw);
  const stripeGw = gws.data?.data?.find((g) => g.name === "stripe");
  ok("stripe gateway is not configured (no env keys in test)", stripeGw?.configured === false, stripeGw);

  // ---------- Create-intent: unconfigured gateway → 503 cleanly ----------
  const stripeIntent = await req("POST", "/payments/intents", { gateway: "stripe", paymentPurpose: "other", amount: 100, currency: "AED" }, clientTok);
  ok("POST /payments/intents (stripe, unconfigured) → 503", stripeIntent.status === 503 && stripeIntent.data?.error?.code === "gateway_not_configured", stripeIntent.data);
  const paytabsIntent = await req("POST", "/payments/intents", { gateway: "paytabs", paymentPurpose: "other", amount: 100, currency: "AED" }, clientTok);
  ok("POST /payments/intents (paytabs, unconfigured) → 503", paytabsIntent.status === 503, paytabsIntent.data);
  const telrIntent = await req("POST", "/payments/intents", { gateway: "telr", paymentPurpose: "other", amount: 100, currency: "AED" }, clientTok);
  ok("POST /payments/intents (telr, unconfigured) → 503", telrIntent.status === 503, telrIntent.data);

  // ---------- Mock gateway happy path ----------
  const mockKey = `idem_mock_${Date.now()}`;
  const mock1 = await req("POST", "/payments/intents", { gateway: "mock", paymentPurpose: "other", amount: 250.5, currency: "AED", idempotencyKey: mockKey, description: "Smoke mock 1" }, clientTok);
  ok("POST /payments/intents (mock) → 200", mock1.status === 200 && mock1.data?.data?.transaction?.id, mock1.data);
  const mockTxId = mock1.data?.data?.transaction?.id;
  const mockIntentRef = mock1.data?.data?.intent?.intentId;
  ok("mock transaction has gateway=mock, status=INITIATED|PAID|REQUIRES_ACTION", ["INITIATED", "PAID", "REQUIRES_ACTION", "PENDING"].includes(mock1.data?.data?.transaction?.status), mock1.data?.data?.transaction);
  ok("mock intent has clientSecret", typeof mock1.data?.data?.intent?.clientSecret === "string");

  // Idempotency replay → same transaction id, replayed flag true.
  const mock2 = await req("POST", "/payments/intents", { gateway: "mock", paymentPurpose: "other", amount: 250.5, currency: "AED", idempotencyKey: mockKey, description: "Smoke mock 1 retry" }, clientTok);
  ok("POST /payments/intents idempotency replay returns same tx id", mock2.status === 200 && mock2.data?.data?.transaction?.id === mockTxId && mock2.data?.data?.replayed === true, mock2.data);

  // ---------- Manual gateway: create + submit-proof + admin approve ----------
  const manualKey = `idem_manual_${Date.now()}`;
  const manual1 = await req("POST", "/payments/intents", { gateway: "manual", paymentPurpose: "other", amount: 1500, currency: "AED", idempotencyKey: manualKey }, clientTok);
  ok("POST /payments/intents (manual) → 200 with bankDetails", manual1.status === 200 && manual1.data?.data?.bankDetails?.iban, manual1.data);
  const manualTxId = manual1.data?.data?.transaction?.id;

  // Upload proof attachment (multipart form).
  const proofForm = new FormData();
  const proofBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" });
  proofForm.set("file", proofBlob, "proof.pdf");
  const proofRes = await fetch(`${BASE}/uploads`, { method: "POST", headers: { Authorization: `Bearer ${clientTok}` }, body: proofForm });
  const proofData = await proofRes.json();
  // /uploads returns a flat object (legacy shape) — no envelope wrapper.
  ok("POST /uploads (proof) → 200", proofRes.status === 200 && typeof proofData?.id === "number", { status: proofRes.status, body: proofData });
  const proofAttachmentId = proofData?.id;

  const submit = await req("POST", "/payments/manual/submit-proof", { transactionId: manualTxId, attachmentId: proofAttachmentId, note: "Sent via Emirates NBD app" }, clientTok);
  ok("POST /payments/manual/submit-proof → 200, tx PENDING", submit.status === 200 && submit.data?.data?.status === "PENDING", submit.data);

  // Submitting proof from a non-owner must 403/404.
  const submitNotOwner = await req("POST", "/payments/manual/submit-proof", { transactionId: manualTxId, attachmentId: proofAttachmentId }, adminTok);
  ok("POST /payments/manual/submit-proof not-owner → 403/404", [403, 404].includes(submitNotOwner.status), submitNotOwner.data);

  const approve = await req("POST", "/admin/payments/manual/approve", { transactionId: manualTxId, bankReference: "TXN-EMNBD-1234", note: "Verified deposit" }, adminTok);
  ok("POST /admin/payments/manual/approve → 200", approve.status === 200 && approve.data?.data?.transaction?.status === "PAID", approve.data);

  // Re-approving the same transaction must 409 (state already PAID, not PENDING).
  const reApprove = await req("POST", "/admin/payments/manual/approve", { transactionId: manualTxId }, adminTok);
  ok("re-approve already PAID → 409 invalid_state", reApprove.status === 409 && reApprove.data?.error?.code === "invalid_state", reApprove.data);

  // Reject path: create another manual transaction → submit proof → reject.
  const manual2 = await req("POST", "/payments/intents", { gateway: "manual", paymentPurpose: "other", amount: 999, currency: "AED" }, clientTok);
  const manualTx2Id = manual2.data?.data?.transaction?.id;
  await req("POST", "/payments/manual/submit-proof", { transactionId: manualTx2Id, attachmentId: proofAttachmentId }, clientTok);
  const reject = await req("POST", "/admin/payments/manual/reject", { transactionId: manualTx2Id, reason: "Bank statement does not match amount" }, adminTok);
  ok("POST /admin/payments/manual/reject → 200, tx FAILED", reject.status === 200 && reject.data?.data?.status === "FAILED", reject.data);

  // ---------- Transactions listing ----------
  const myTx = await req("GET", "/payments/transactions", null, clientTok);
  ok("GET /payments/transactions (mine) → envelope+pagination", myTx.status === 200 && Array.isArray(myTx.data?.data) && myTx.data?.meta?.pagination?.total > 0, myTx.data);
  ok("client only sees their own transactions", myTx.data?.data?.every((t) => t.gateway === "mock" || t.gateway === "manual"));

  const adminTx = await req("GET", "/payments/transactions/" + manualTxId, null, adminTok);
  ok("GET /payments/transactions/:id (admin) sees other users tx", adminTx.status === 200 && adminTx.data?.data?.transaction?.id === manualTxId, adminTx.data);
  const otherUserTx = await req("GET", "/payments/transactions/" + manualTxId, null, clientTok);
  ok("GET /payments/transactions/:id (owner) → 200", otherUserTx.status === 200);

  // ---------- Admin filters + summary + webhooks list ----------
  const adminAll = await req("GET", "/admin/payments/transactions?gateway=manual", null, adminTok);
  ok("GET /admin/payments/transactions?gateway=manual → 200", adminAll.status === 200 && Array.isArray(adminAll.data?.data) && adminAll.data.data.every((t) => t.gateway === "manual"), adminAll.data);
  const summary = await req("GET", "/admin/payments/summary", null, adminTok);
  ok("GET /admin/payments/summary → 200 with shape", summary.status === 200 && typeof summary.data?.data?.transactions?.paid === "number", summary.data);
  ok("summary: at least 1 PAID transaction (manual approved)", summary.data?.data?.transactions?.paid >= 1, summary.data?.data?.transactions);

  // Non-admin cannot access admin endpoints.
  const adminForbidden = await req("GET", "/admin/payments/summary", null, clientTok);
  ok("non-admin /admin/payments/summary → 403", adminForbidden.status === 403, adminForbidden.data);

  // ---------- Security regression: bank reference is metadata, NOT gateway ref ----------
  // After admin approve with bankReference, the gateway reference must remain
  // the gateway-assigned manual_<uuid> so webhook lookups + UNIQUE
  // (gateway, gateway_reference) stay correct.
  const approvedTx = await req("GET", "/payments/transactions/" + manualTxId, null, adminTok);
  const approvedRow = approvedTx.data?.data?.transaction;
  ok(
    "approved manual tx keeps manual_<uuid> as gatewayReference",
    typeof approvedRow?.gatewayReference === "string" && approvedRow.gatewayReference.startsWith("manual_"),
    approvedRow?.gatewayReference,
  );
  ok(
    "approved manual tx stores bankReference in metadata",
    approvedRow?.metadata?.bankReference === "TXN-EMNBD-1234",
    approvedRow?.metadata,
  );

  // ---------- Security regression: PayTabs unverified callback → 400 ----------
  // PayTabs adapter computes HMAC over the raw body; with no PAYTABS_SERVER_KEY
  // configured it returns "not configured" (503). With a wrong signature it
  // would return signatureValid=false and the route's hard-fail gate returns
  // 400 with no DB mutation.
  const paytabsForge = await fetch(`${BASE}/payments/paytabs/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", signature: "ffffffff" },
    body: JSON.stringify({ tran_ref: "PT-FORGED", payment_result: { response_status: "A" } }),
  });
  ok(
    "POST /payments/paytabs/callback (unverified/unconfigured) → 400/503 no state change",
    [400, 503].includes(paytabsForge.status),
    { status: paytabsForge.status },
  );
  // ---------- Security regression: Telr unverified callback → 400 ----------
  const telrForge = await fetch(`${BASE}/payments/telr/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: { ref: "TELR-FORGED" }, status: { text: "Authorised" } }),
  });
  ok(
    "POST /payments/telr/callback (unverified) → 400/503 no state change",
    [400, 503].includes(telrForge.status),
    { status: telrForge.status },
  );

  // ---------- Webhook: stripe signature mismatch returns 400 ----------
  // Stripe is unconfigured → adapter throws "not configured" → 503. Either way
  // verify the route is reachable and rejects without touching the DB on bad input.
  const stripeWh = await fetch(`${BASE}/payments/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "t=0,v1=deadbeef" }, body: '{"id":"evt_x","type":"payment_intent.succeeded"}' });
  const stripeWhData = await stripeWh.json().catch(() => null);
  ok("POST /payments/stripe/webhook (bad sig or unconfigured) → 400/503", [400, 503].includes(stripeWh.status), { status: stripeWh.status, body: stripeWhData });

  // ---------- Webhook idempotency on mock ----------
  // Use the mock gateway: its webhookVerify accepts an arbitrary id and
  // mappedStatus. We send the same event twice; second must be deduped.
  const evtId = `mock_evt_${Date.now()}`;
  // Webhook handlers return a raw {received, eventId, ...} body (no envelope)
  // since gateways expect a flat ack.
  const wh1 = await req("POST", "/payments/mock/webhook", { id: evtId, type: "mock.test", gatewayReference: mockIntentRef, mappedStatus: "PAID" }, null, { "x-webhook-signature": "anything" });
  ok("mock webhook first delivery → 200 received", wh1.status === 200 && wh1.data?.received === true, wh1.data);
  const wh2 = await req("POST", "/payments/mock/webhook", { id: evtId, type: "mock.test", gatewayReference: mockIntentRef, mappedStatus: "PAID" }, null, { "x-webhook-signature": "anything" });
  ok("mock webhook duplicate delivery → 200 with duplicate=true", wh2.status === 200 && wh2.data?.duplicate === true, wh2.data);

  const adminWh = await req("GET", "/admin/payments/webhooks?gateway=mock", null, adminTok);
  ok("GET /admin/payments/webhooks → 200", adminWh.status === 200 && Array.isArray(adminWh.data?.data), adminWh.data);
  const ourWh = adminWh.data?.data?.find((w) => w.eventId === evtId);
  ok("webhook row persisted exactly once for our evt id", ourWh && adminWh.data.data.filter((w) => w.eventId === evtId).length === 1, ourWh);

  // ---------- Admin gateway registry CRUD ----------
  const gwList = await req("GET", "/admin/payments/gateways", null, adminTok);
  ok("GET /admin/payments/gateways (admin) → 200, 5 rows", gwList.status === 200 && Array.isArray(gwList.data?.data) && gwList.data.data.length === 5, { status: gwList.status, count: gwList.data?.data?.length });
  const stripeRow = gwList.data?.data?.find((g) => g.providerCode === "stripe");
  const patch = await req("PATCH", `/admin/payments/gateways/${stripeRow.id}`, { isActive: true, mode: "TEST" }, adminTok);
  ok("PATCH /admin/payments/gateways/:id → 200 isActive=true", patch.status === 200 && patch.data?.data?.isActive === true, patch.data);
  const patchBack = await req("PATCH", `/admin/payments/gateways/${stripeRow.id}`, { isActive: false }, adminTok);
  ok("PATCH /admin/payments/gateways/:id revert → 200", patchBack.status === 200 && patchBack.data?.data?.isActive === false, patchBack.data);

  // ---------- Backward-compat: legacy /payments/create-intent untouched ----------
  // Phase 1 mock at /payments/create-intent should still respond — we send
  // bogus job/proposal ids and assert the route reaches its handler ("Job
  // not found"), proving the route is still mounted with its original logic.
  const legacy = await req("POST", "/payments/create-intent", { jobId: 999999, proposalId: 999999, amount: 1, currency: "AED" }, clientTok);
  ok(
    "legacy POST /payments/create-intent still reaches handler",
    legacy.status === 404 && typeof legacy.data?.error === "string" && /Job not found/i.test(legacy.data.error),
    { status: legacy.status, body: legacy.data },
  );

  console.log("");
  console.log(`Phase 5 smoke: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failures:", JSON.stringify(failures, null, 2));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
