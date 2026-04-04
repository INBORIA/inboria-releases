import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import emailsRouter from "./emails";
import categoriesRouter from "./categories";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import emailConnectRouter from "./email-connect";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(emailsRouter);
router.use(categoriesRouter);
router.use(tasksRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(emailConnectRouter);

export default router;
