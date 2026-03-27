import { db, servicePaymentsTable } from "@workspace/db";
import cors from "cors";
import { eq } from "drizzle-orm";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { MercadoPagoConfig, Payment } from "mercadopago";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust proxy (Render/Replit)
app.set("trust proxy", 1);

// ── Webhook Mercado Pago ─────────────────────────────────────────
app.post("/api/payment/webhook", express.json(), async (req, res) => {
  try {
    const { type, data } = req.body ?? {};

    if (type !== "payment" || !data?.id) {
      return res.json({ received: true });
    }

    const mpPaymentId = String(data.id);

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      logger.error("MERCADO_PAGO_ACCESS_TOKEN não configurado");
      return res.json({ received: true });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const mpPayment = new Payment(client);

    let paymentInfo: any;
    try {
      paymentInfo = await mpPayment.get({ id: parseInt(mpPaymentId) });
    } catch (mpErr: any) {
      logger.error({ err: mpErr }, "Erro ao buscar pagamento");
      return res.status(500).json({ error: "Erro ao verificar pagamento" });
    }

    const serviceId = paymentInfo.external_reference;
    const mpStatus = paymentInfo.status;

    logger.info({ mpPaymentId, serviceId, mpStatus });

    if (mpStatus === "approved" && serviceId) {
      await db
        .update(servicePaymentsTable)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(servicePaymentsTable.serviceId, serviceId))
        .catch((e) => logger.error({ err: e }));

      logger.info("Pagamento aprovado");
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error({ err: error });
    res.status(500).json({ error: "Erro no webhook" });
  }
});

// ── Rate limit ───────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas. Aguarde 15 minutos." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Muitas requisições." },
});

// ── Middlewares ──────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// 🔥 ROTA DE TESTE
app.get("/ping", (req, res) => {
  res.send("pong");
});

// ── Rotas principais ─────────────────────────────────────────────
app.use("/api", router);

export default app;
