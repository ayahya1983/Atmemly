import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import metaRouter from "./meta";
import usersRouter from "./users";
import jobsRouter from "./jobs";
import proposalsRouter from "./proposals";
import conversationsRouter from "./conversations";
import reviewsRouter from "./reviews";
import notificationsRouter from "./notifications";
import paymentsRouter from "./payments";
import adminRouter from "./admin";
import verificationsRouter from "./verifications";
import contractsRouter from "./contracts";
import walletRouter from "./wallet";
import invoicesRouter from "./invoices";
import disputesRouter from "./disputes";
import uploadsRouter from "./uploads";
import legalRouter from "./legal";
import settingsRouter from "./settings";
import analyticsRouter from "./analytics";
import recommendationsRouter from "./recommendations";
import savedSearchesRouter from "./savedSearches";
import reportsRouter from "./reports";
import seoRouter from "./seo";
import scoringRouter from "./scoring";
import devicesRouter from "./devices";
import paymentsGatewayRouter from "./paymentsGateway";
import escrowAdminRouter from "./escrowAdmin";
import payoutBatchesRouter from "./payoutBatches";
import featuredRouter from "./featured";
import subscriptionsRouter from "./subscriptions";
import currenciesRouter from "./currencies";
import reconciliationRouter from "./reconciliation";
import moderationRouter from "./moderation";
import metricsRouter from "./metrics";
import invoicesTaxRouter from "./invoicesTax";
import paymentsV2Router from "./paymentsV2";
import paymentsAdminRouter from "./paymentsAdmin";
// Phase 6 — admin panel
import adminDashboardRouter from "./adminDashboard";
import adminUsersV2Router from "./adminUsersV2";
import adminPeopleRouter from "./adminPeople";
import adminWorkflowRouter from "./adminWorkflow";
import adminContentRouter from "./adminContent";
import adminBroadcastRouter from "./adminBroadcast";
import adminReportsRouter from "./adminReports";
// Task #8 — ATMEMLY enterprise SSO
import ssoRouter from "./sso";
import adminSsoRouter from "./adminSso";
import { attachUser } from "../lib/auth";
import { mountRateLimitPolicies } from "../lib/rateLimitPolicies";

const router: IRouter = Router();

router.use(attachUser);

// Per-IP limiters for payment gateway webhooks/callbacks and admin write
// actions. Mounted before route handlers so they sit in the request
// pipeline. See ../lib/rateLimitPolicies.ts for limits and rationale.
mountRateLimitPolicies(router);

router.use(healthRouter);
router.use(authRouter);
router.use(metaRouter);
router.use(usersRouter);
router.use(jobsRouter);
router.use(proposalsRouter);
router.use(conversationsRouter);
router.use(reviewsRouter);
router.use(notificationsRouter);
router.use(paymentsRouter);
router.use(verificationsRouter);
router.use(contractsRouter);
router.use(walletRouter);
router.use(invoicesRouter);
router.use(disputesRouter);
router.use(uploadsRouter);
router.use(legalRouter);
router.use(settingsRouter);
router.use(analyticsRouter);
// Phase 3
router.use(recommendationsRouter);
router.use(savedSearchesRouter);
router.use(reportsRouter);
router.use(seoRouter);
router.use(scoringRouter);
router.use(adminRouter);

// Phase 4
router.use(devicesRouter);
router.use(paymentsGatewayRouter);
router.use(escrowAdminRouter);
router.use(payoutBatchesRouter);
router.use(featuredRouter);
router.use(subscriptionsRouter);
router.use(currenciesRouter);
router.use(reconciliationRouter);
router.use(moderationRouter);
router.use(metricsRouter);
router.use(invoicesTaxRouter);

// Phase 5
router.use(paymentsV2Router);
router.use(paymentsAdminRouter);

// Phase 6 — admin panel
router.use(adminDashboardRouter);
router.use(adminUsersV2Router);
router.use(adminPeopleRouter);
router.use(adminWorkflowRouter);
router.use(adminContentRouter);
router.use(adminBroadcastRouter);
router.use(adminReportsRouter);
router.use(ssoRouter);
router.use(adminSsoRouter);

export default router;
