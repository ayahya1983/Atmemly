import { and, eq, sql } from "drizzle-orm";
import {
  db,
  freelancerProfilesTable,
  clientProfilesTable,
  contractsTable,
  reviewsTable,
  disputesTable,
  milestonesTable,
} from "@workspace/db";

/**
 * Phase 3 scoring helpers.
 *
 * Scores are stored on the profile row as a denormalized integer 0..100.
 * Recompute is best-effort and idempotent; it should be called after
 * any event that materially affects the score.
 */

export interface FreelancerScoreBreakdown {
  trustScore: number;
  components: {
    completedContracts: number; // up to 30
    avgRating: number; // up to 30
    verification: number; // up to 15
    lowDispute: number; // up to 15
    onTimeApprovals: number; // up to 10
  };
  inputs: {
    completedContracts: number;
    activeContracts: number;
    avgRating: number;
    reviewCount: number;
    verificationStatus: string;
    disputeCount: number;
    revisedMilestones: number;
    releasedMilestones: number;
  };
}

export async function recomputeFreelancerTrust(
  freelancerId: number,
): Promise<FreelancerScoreBreakdown | null> {
  const [profile] = await db
    .select()
    .from(freelancerProfilesTable)
    .where(eq(freelancerProfilesTable.userId, freelancerId));
  if (!profile) return null;

  const [contractAgg] = await db
    .select({
      completed: sql<number>`count(*) filter (where ${contractsTable.status} = 'completed')::int`,
      active: sql<number>`count(*) filter (where ${contractsTable.status} in ('active','submitted_for_review','revision_requested'))::int`,
    })
    .from(contractsTable)
    .where(eq(contractsTable.freelancerId, freelancerId));

  const [reviewAgg] = await db
    .select({
      avg: sql<string>`coalesce(avg(rating)::text, '0')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, freelancerId));

  const [disputeAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(disputesTable)
    .where(eq(disputesTable.raisedAgainstId, freelancerId));

  const [milestoneAgg] = await db
    .select({
      released: sql<number>`count(*) filter (where ${milestonesTable.status} = 'released')::int`,
      revised: sql<number>`count(*) filter (where ${milestonesTable.status} = 'revision_requested')::int`,
    })
    .from(milestonesTable)
    .innerJoin(contractsTable, eq(contractsTable.id, milestonesTable.contractId))
    .where(eq(contractsTable.freelancerId, freelancerId));

  const completed = Number(contractAgg?.completed ?? 0);
  const active = Number(contractAgg?.active ?? 0);
  const avgRating = Number(reviewAgg?.avg ?? 0);
  const reviewCount = Number(reviewAgg?.count ?? 0);
  const disputeCount = Number(disputeAgg?.count ?? 0);
  const released = Number(milestoneAgg?.released ?? 0);
  const revised = Number(milestoneAgg?.revised ?? 0);

  // Components (capped). Tuned for 0..100 range.
  const completedContractsScore = Math.min(30, completed * 5);
  const ratingScore = reviewCount > 0 ? Math.min(30, Math.round((avgRating / 5) * 30)) : 0;
  const verificationScore = profile.verificationStatus === "verified" ? 15 : 0;
  // Penalize disputes lightly: 15 minus 3 per dispute, floor 0.
  const lowDisputeScore = Math.max(0, 15 - disputeCount * 3);
  // On-time: ratio of released vs released+revised milestones, scaled to 10.
  const onTimeBase = released + revised;
  const onTimeScore = onTimeBase > 0 ? Math.round((released / onTimeBase) * 10) : 0;

  const trustScore = Math.max(
    0,
    Math.min(
      100,
      completedContractsScore +
        ratingScore +
        verificationScore +
        lowDisputeScore +
        onTimeScore,
    ),
  );

  await db
    .update(freelancerProfilesTable)
    .set({ trustScore, lastScoreAt: new Date() })
    .where(eq(freelancerProfilesTable.userId, freelancerId));

  return {
    trustScore,
    components: {
      completedContracts: completedContractsScore,
      avgRating: ratingScore,
      verification: verificationScore,
      lowDispute: lowDisputeScore,
      onTimeApprovals: onTimeScore,
    },
    inputs: {
      completedContracts: completed,
      activeContracts: active,
      avgRating,
      reviewCount,
      verificationStatus: profile.verificationStatus,
      disputeCount,
      revisedMilestones: revised,
      releasedMilestones: released,
    },
  };
}

export interface ClientScoreBreakdown {
  qualityScore: number;
  components: {
    fundedContracts: number; // up to 30
    paymentReliability: number; // up to 30
    avgRatingFromFreelancers: number; // up to 20
    lowDispute: number; // up to 10
    verification: number; // up to 10
  };
  inputs: {
    fundedContracts: number;
    completedContracts: number;
    avgRatingFromFreelancers: number;
    reviewCount: number;
    disputeCount: number;
    verificationStatus: string;
  };
}

export async function recomputeClientQuality(
  clientId: number,
): Promise<ClientScoreBreakdown | null> {
  const [profile] = await db
    .select()
    .from(clientProfilesTable)
    .where(eq(clientProfilesTable.userId, clientId));
  if (!profile) return null;

  const [contractAgg] = await db
    .select({
      funded: sql<number>`count(*) filter (where ${contractsTable.status} <> 'pending_client_payment')::int`,
      completed: sql<number>`count(*) filter (where ${contractsTable.status} = 'completed')::int`,
    })
    .from(contractsTable)
    .where(eq(contractsTable.clientId, clientId));

  const [reviewAgg] = await db
    .select({
      avg: sql<string>`coalesce(avg(rating)::text, '0')`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.toUserId, clientId));

  const [disputeAgg] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(disputesTable)
    .where(eq(disputesTable.raisedAgainstId, clientId));

  const funded = Number(contractAgg?.funded ?? 0);
  const completed = Number(contractAgg?.completed ?? 0);
  const avgRating = Number(reviewAgg?.avg ?? 0);
  const reviewCount = Number(reviewAgg?.count ?? 0);
  const disputeCount = Number(disputeAgg?.count ?? 0);

  const fundedScore = Math.min(30, funded * 5);
  // Payment reliability = completed / funded ratio scaled to 30
  const paymentReliability =
    funded > 0 ? Math.round((completed / funded) * 30) : 0;
  const ratingScore = reviewCount > 0 ? Math.min(20, Math.round((avgRating / 5) * 20)) : 0;
  const lowDisputeScore = Math.max(0, 10 - disputeCount * 2);
  const verificationScore = profile.verificationStatus === "verified" ? 10 : 0;

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      fundedScore + paymentReliability + ratingScore + lowDisputeScore + verificationScore,
    ),
  );

  await db
    .update(clientProfilesTable)
    .set({ qualityScore, lastScoreAt: new Date() })
    .where(eq(clientProfilesTable.userId, clientId));

  return {
    qualityScore,
    components: {
      fundedContracts: fundedScore,
      paymentReliability,
      avgRatingFromFreelancers: ratingScore,
      lowDispute: lowDisputeScore,
      verification: verificationScore,
    },
    inputs: {
      fundedContracts: funded,
      completedContracts: completed,
      avgRatingFromFreelancers: avgRating,
      reviewCount,
      disputeCount,
      verificationStatus: profile.verificationStatus,
    },
  };
}

export async function recomputeAll(): Promise<{ freelancers: number; clients: number }> {
  const fls = await db
    .select({ uid: freelancerProfilesTable.userId })
    .from(freelancerProfilesTable);
  const clients = await db
    .select({ uid: clientProfilesTable.userId })
    .from(clientProfilesTable);
  for (const f of fls) await recomputeFreelancerTrust(f.uid);
  for (const c of clients) await recomputeClientQuality(c.uid);
  return { freelancers: fls.length, clients: clients.length };
}

/**
 * Fire-and-forget recompute helper for use inside request handlers.
 * Never blocks the caller; logs failures via console.warn.
 */
export function recomputeForUserAsync(
  userId: number,
  role: "freelancer" | "client" | string | null | undefined,
): void {
  setImmediate(() => {
    const p =
      role === "freelancer"
        ? recomputeFreelancerTrust(userId)
        : role === "client"
          ? recomputeClientQuality(userId)
          : Promise.resolve();
    Promise.resolve(p).catch((err) => {
      console.warn("recomputeForUserAsync failed", { userId, role, err });
    });
  });
}

/** Convenience for routes that already know both ids (e.g. contract complete). */
export function recomputePairAsync(freelancerUserId: number, clientUserId: number): void {
  setImmediate(() => {
    Promise.allSettled([
      recomputeFreelancerTrust(freelancerUserId),
      recomputeClientQuality(clientUserId),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === "rejected") console.warn("recomputePairAsync failed", r.reason);
      }
    });
  });
}
