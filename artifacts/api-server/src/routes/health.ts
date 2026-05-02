import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/** Liveness — process is up. */
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/** Readiness — DB reachable. */
router.get("/readyz", async (_req, res): Promise<void> => {
  try {
    await db.execute(sql`select 1 as ok`);
    res.json({ status: "ready", db: "ok" });
  } catch (err) {
    res.status(503).json({
      status: "not_ready",
      db: "error",
      error: (err as Error).message,
    });
  }
});

export default router;
