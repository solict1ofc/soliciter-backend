import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import paymentRouter from "./payment";
import serviceRouter from "./service";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(paymentRouter);
router.use(serviceRouter);

export default router;
