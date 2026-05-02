import { Router, type IRouter } from "express";
import { requireAuth, requireRole } from "../lib/auth";
import { respond } from "../lib/apiResponse";
import { getMetricsSnapshot } from "../lib/metrics";

const router: IRouter = Router();

router.get(
  "/metrics",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    respond(res, getMetricsSnapshot());
  },
);

export default router;
