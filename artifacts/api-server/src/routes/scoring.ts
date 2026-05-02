import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  freelancerProfilesTable,
  clientProfilesTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";
import { audit } from "../lib/audit";
import {
  recomputeAll,
  recomputeClientQuality,
  recomputeFreelancerTrust,
} from "../lib/scoring";

const router: IRouter = Router();

router.get("/freelancers/:id/trust", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({ trustScore: freelancerProfilesTable.trustScore, updated: freelancerProfilesTable.lastScoreAt })
    .from(freelancerProfilesTable)
    .where(eq(freelancerProfilesTable.userId, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ userId: id, trustScore: row.trustScore, updatedAt: row.updated });
});

router.get("/clients/:id/quality", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select({ qualityScore: clientProfilesTable.qualityScore, updated: clientProfilesTable.lastScoreAt })
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ userId: id, qualityScore: row.qualityScore, updatedAt: row.updated });
});

router.post(
  "/admin/scoring/recompute/:userId",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params["userId"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    let payload: unknown = null;
    if (u.role === "freelancer") payload = await recomputeFreelancerTrust(id);
    else if (u.role === "client") payload = await recomputeClientQuality(id);
    else {
      res.status(400).json({ error: "User has no scorable role" });
      return;
    }
    await audit(req, "scoring.recompute", "user", id, { role: u.role });
    res.json(payload);
  },
);

router.post(
  "/admin/scoring/recompute-all",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const result = await recomputeAll();
    await audit(req, "scoring.recompute_all", "scoring", null, result);
    res.json(result);
  },
);

export default router;
