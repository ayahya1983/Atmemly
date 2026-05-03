import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./lib/security";
import { metricsMiddleware } from "./lib/metrics";

const app: Express = express();

// Trust the Replit proxy chain so req.ip + rate-limit see the real client IP.
app.set("trust proxy", 1);

// Stable request id for log correlation; reuse incoming x-request-id when present.
// Also exposes Phase 4 mobile API version header.
app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[a-zA-Z0-9-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader("X-Request-Id", id);
  res.setHeader("X-API-Version", "4");
  next();
});

// Architecture audit (May 2026) — helmet hardens HTTP response headers
// (X-Frame-Options, X-DNS-Prefetch-Control, Referrer-Policy, etc.). CSP is
// disabled here because the API never serves HTML; the marketplace front
// end is hosted by Vite/Replit's preview proxy and applies its own CSP.
// COEP/CORP are also off so that uploaded files served from /api/uploads
// remain embeddable from the marketplace origin.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
// Legacy securityHeaders() retained as a defense-in-depth fallback for
// any header helmet doesn't set (e.g. our custom X-API-Version).
app.use(securityHeaders());
app.use(metricsMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as Request & { id?: string }).id ?? randomUUID(),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ exposedHeaders: ["X-Request-Id", "X-API-Version"] }));

// Webhook routes MUST receive the raw request body so signature verification
// runs over the exact bytes the gateway signed (Stripe HMAC, PayTabs HMAC,
// Telr/manual best-effort). Register raw-body parsers BEFORE express.json()
// for every webhook path; otherwise express.json() consumes the stream and
// JSON.stringify(req.body) produces a different byte sequence than what was
// signed.
app.use(
  [
    "/api/payments/stripe/webhook",
    "/api/payments/paytabs/callback",
    "/api/payments/telr/callback",
    "/api/payments/mock/webhook",
  ],
  express.raw({ type: "*/*", limit: "1mb" }),
);

// JSON / form bodies capped at 1mb. Multer file uploads are handled per-route at 10mb.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Centralized error handler — logs and returns JSON 500 (or 413 for body too large).
app.use((err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  req.log?.error?.({ err }, "unhandled request error");
  if (res.headersSent) return;
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
});

export default app;
