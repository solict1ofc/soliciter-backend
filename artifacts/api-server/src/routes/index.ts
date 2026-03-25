import { Router, type IRouter } from "express";
import adminRouter    from "./admin";
import authRouter     from "./auth";
import healthRouter   from "./health";
import paymentRouter  from "./payment";
import webhookRouter  from "./pix";       // webhook-only; payment logic is in payment.ts
import serviceRouter  from "./service";
import withdrawRouter from "./withdraw";  // POST /sacar

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(paymentRouter);   // POST /create-payment, GET /payment-status/:id, POST /payment/release/:id
router.use(webhookRouter);   // POST /webhook (Mercado Pago notifications)
router.use(serviceRouter);
router.use(adminRouter);     // GET|PUT /admin/payouts (requires ADMIN_SECRET)
router.use(withdrawRouter);  // POST /sacar

export default router;
