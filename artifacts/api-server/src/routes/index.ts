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
import { attachUser } from "../lib/auth";

const router: IRouter = Router();

router.use(attachUser);

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
router.use(adminRouter);

export default router;
