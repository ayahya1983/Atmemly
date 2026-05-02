import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

function parseRange(req: { query: Record<string, unknown> }): { from: Date; to: Date } {
  const fromStr = typeof req.query["from"] === "string" ? req.query["from"] : undefined;
  const toStr = typeof req.query["to"] === "string" ? req.query["to"] : undefined;
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr
    ? new Date(fromStr)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Revenue: GMV (sum of milestone funded amounts), platform fees, VAT, net to freelancers. */
router.get(
  "/admin/reports/revenue",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { from, to } = parseRange(req);
    const result = (await db.execute(sql`
      SELECT
        COALESCE(SUM(amount), 0)::float                AS gmv,
        COALESCE(SUM(platform_fee_amount), 0)::float   AS platform_fees,
        COALESCE(SUM(freelancer_net_amount), 0)::float AS freelancer_net,
        COUNT(*)::int                                  AS transactions
      FROM payments
      WHERE created_at >= ${from} AND created_at <= ${to}
        AND status IN ('held', 'released', 'succeeded')
    `)) as unknown as {
      rows: Array<{
        gmv: number;
        platform_fees: number;
        freelancer_net: number;
        transactions: number;
      }>;
    };
    const r = result.rows[0] ?? {
      gmv: 0,
      platform_fees: 0,
      freelancer_net: 0,
      transactions: 0,
    };
    const vatResult = (await db.execute(sql`
      SELECT COALESCE(SUM(vat_amount), 0)::float AS vat
      FROM invoices
      WHERE issued_at >= ${from} AND issued_at <= ${to}
    `)) as unknown as { rows: Array<{ vat: number }> };
    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      currency: "AED",
      gmv: r.gmv,
      platformFees: r.platform_fees,
      freelancerNet: r.freelancer_net,
      vat: vatResult.rows[0]?.vat ?? 0,
      transactions: r.transactions,
    });
  },
);

/** Payouts report. */
router.get(
  "/admin/reports/payouts",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const { from, to } = parseRange(req);
    const result = (await db.execute(sql`
      SELECT
        status,
        COUNT(*)::int                AS count,
        COALESCE(SUM(amount), 0)::float AS total
      FROM payouts
      WHERE requested_at >= ${from} AND requested_at <= ${to}
      GROUP BY status
      ORDER BY status
    `)) as unknown as { rows: Array<{ status: string; count: number; total: number }> };
    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      currency: "AED",
      byStatus: result.rows,
    });
  },
);

/** Cohort: count of users who first did `metric` per signup-month. */
router.get(
  "/admin/reports/cohorts",
  requireAuth,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const months = Math.min(Math.max(Number(req.query["months"] ?? 6), 1), 24);
    const metric =
      typeof req.query["metric"] === "string" ? req.query["metric"] : "signups";
    if (metric === "signups") {
      const result = (await db.execute(sql`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS cohort,
               COUNT(*)::int AS users
        FROM users
        WHERE created_at >= now() - (${months} || ' months')::interval
        GROUP BY 1
        ORDER BY 1
      `)) as unknown as { rows: Array<{ cohort: string; users: number }> };
      res.json({ metric, months, rows: result.rows });
      return;
    }
    if (metric === "first_contract") {
      const result = (await db.execute(sql`
        WITH first_contract AS (
          SELECT u.id AS user_id,
                 to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS cohort,
                 MIN(c.created_at) AS first_at
          FROM users u
          LEFT JOIN contracts c ON c.client_id = u.id OR c.freelancer_id = u.id
          WHERE u.created_at >= now() - (${months} || ' months')::interval
          GROUP BY u.id
        )
        SELECT cohort,
               COUNT(*)::int AS signups,
               COUNT(first_at)::int AS converted
        FROM first_contract
        GROUP BY cohort
        ORDER BY cohort
      `)) as unknown as {
        rows: Array<{ cohort: string; signups: number; converted: number }>;
      };
      res.json({ metric, months, rows: result.rows });
      return;
    }
    res.status(400).json({ error: "Unknown metric" });
  },
);

router.get(
  "/admin/reports/top-clients",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const result = (await db.execute(sql`
      SELECT u.id, u.full_name, COALESCE(SUM(p.amount), 0)::float AS gmv,
             COUNT(p.id)::int AS payments
      FROM users u
      LEFT JOIN payments p ON p.payer_id = u.id AND p.status IN ('held','released','succeeded')
      WHERE u.role = 'client'
      GROUP BY u.id, u.full_name
      ORDER BY gmv DESC
      LIMIT 20
    `)) as unknown as {
      rows: Array<{ id: number; full_name: string; gmv: number; payments: number }>;
    };
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        gmv: r.gmv,
        payments: r.payments,
      })),
    );
  },
);

router.get(
  "/admin/reports/top-freelancers",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const result = (await db.execute(sql`
      SELECT u.id, u.full_name,
             COALESCE(SUM(p.freelancer_net_amount), 0)::float AS earnings,
             COUNT(p.id)::int AS payments
      FROM users u
      LEFT JOIN payments p ON p.payee_id = u.id AND p.status IN ('held','released','succeeded')
      WHERE u.role = 'freelancer'
      GROUP BY u.id, u.full_name
      ORDER BY earnings DESC
      LIMIT 20
    `)) as unknown as {
      rows: Array<{ id: number; full_name: string; earnings: number; payments: number }>;
    };
    res.json(
      result.rows.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        earnings: r.earnings,
        payments: r.payments,
      })),
    );
  },
);

router.get(
  "/admin/reports/funnel",
  requireAuth,
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const result = (await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role IN ('client','freelancer'))                         AS signups,
        (SELECT COUNT(DISTINCT freelancer_id)::int FROM proposals)                                       AS first_proposal,
        (SELECT COUNT(DISTINCT client_id)::int FROM contracts)                                           AS first_contract,
        (SELECT COUNT(*)::int FROM contracts WHERE status = 'completed')                                 AS completed_contracts
    `)) as unknown as {
      rows: Array<{
        signups: number;
        first_proposal: number;
        first_contract: number;
        completed_contracts: number;
      }>;
    };
    const r = result.rows[0] ?? {
      signups: 0,
      first_proposal: 0,
      first_contract: 0,
      completed_contracts: 0,
    };
    res.json({
      signups: r.signups,
      firstProposal: r.first_proposal,
      firstContract: r.first_contract,
      completedContracts: r.completed_contracts,
    });
  },
);

export default router;
