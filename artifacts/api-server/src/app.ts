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

// Trust the first proxy (required on Replit, Render, and most cloud platforms)
app.set("trust proxy", 1);

// ── Mercado Pago webhook — must be BEFORE express.json() ──────────────────────
// MP sends JSON directly, no raw body needed (no signature like Stripe)
app.post("/api/payment/webhook", express.json(), async (req, res) => {
  try {
    const { type, data } = req.body ?? {};

    if (type !== "payment" || !data?.id) {
      return res.json({ received: true });
    }

    const mpPaymentId = String(data.id);

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      logger.error("MERCADO_PAGO_ACCESS_TOKEN não configurado — ignorando webhook");
      return res.json({ received: true });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const mpPayment = new Payment(client);

    let paymentInfo: any;
    try {
      paymentInfo = await mpPayment.get({ id: parseInt(mpPaymentId) });
    } catch (mpErr: any) {
      logger.error({ err: mpErr, mpPaymentId }, "Falha ao buscar pagamento no MP");
      return res.status(500).json({ error: "Falha ao verificar pagamento" });
    }

    const serviceId = paymentInfo.external_reference;
    const mpStatus = paymentInfo.status;

    logger.info({ mpPaymentId, serviceId, mpStatus }, "Webhook Mercado Pago recebido");

    if (mpStatus === "approved" && serviceId) {
      await db
        .update(servicePaymentsTable)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(servicePaymentsTable.serviceId, serviceId))
        .catch((e) => logger.error({ err: e }, "Falha ao atualizar pagamento via webhook"));

      logger.info({ serviceId, mpPaymentId }, "Pagamento aprovado via webhook MP");
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error({ err: error }, "Erro no processamento do webhook MP");
    res.status(500).json({ error: "Erro interno no webhook" });
  }
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
  skip: () => process.env.NODE_ENV === "development",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em alguns segundos." },
});

// ── Standard middleware ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);

export default app;
