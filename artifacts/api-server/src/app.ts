import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./lib/security";

const app: Express = express();

// Trust the Replit proxy chain so req.ip + rate-limit see the real client IP.
app.set("trust proxy", 1);

// Stable request id for log correlation; reuse incoming x-request-id when present.
app.use((req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[a-zA-Z0-9-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader("X-Request-Id", id);
  next();
});

app.use(securityHeaders());

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
app.use(cors());
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
