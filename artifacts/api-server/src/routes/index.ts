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
router.use(adminRouter);

export default router;
