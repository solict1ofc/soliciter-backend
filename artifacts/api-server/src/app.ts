import { db, pool, servicePaymentsTable } from "@workspace/db";
import cors from "cors";
import { eq } from "drizzle-orm";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import adminPanelRouter from "./routes/admin-panel";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// Trust the first proxy (required on Replit, Render, and most cloud platforms)
app.set("trust proxy", 1);

// ── CORS — must be FIRST so preflight OPTIONS requests are answered before any route ──
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin"],
  credentials: false,
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── Ping (keep alive para UptimeRobot) ─────────────────────────────
app.get("/ping", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── DB health check ────────────────────────────────────────────────
app.get("/api/db-health", async (_req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(503).json({
      status: "error",
      error: "DATABASE_URL não configurada",
      hint: "Configure DATABASE_URL no painel do Render → Environment",
    });
  }
  const masked = dbUrl.replace(/:([^@]+)@/, ":***@");
  try {
    const result = await pool.query(
      "SELECT NOW() AS ts, current_database() AS db",
    );
    res.json({
      status: "ok",
      db: result.rows[0].db,
      ts: result.rows[0].ts,
      url: masked,
    });
  } catch (err: any) {
    res.status(503).json({
      status: "error",
      error: err.message,
      url: masked,
      hint: "Verifique se DATABASE_URL está correta e o banco está acessível",
    });
  }
});

// ── Root ──────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.send("API funcionando 🚀");
});

// ── Payouts ───────────────────────────────────────────────────────
app.get("/payouts", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payouts ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Mercado Pago webhook ──────────────────────────────────────────
app.post("/api/payment/webhook", express.json(), async (req, res) => {
  try {
    const { type, data } = req.body ?? {};

    if (type !== "payment" || !data?.id) {
      return res.json({ received: true });
    }

    const mpPaymentId = String(data.id);

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      logger.error(
        "MERCADO_PAGO_ACCESS_TOKEN não configurado — ignorando webhook",
      );
      return res.json({ received: true });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const mpPayment = new Payment(client);

    let paymentInfo: any;
    try {
      paymentInfo = await mpPayment.get({ id: parseInt(mpPaymentId) });
    } catch (mpErr: any) {
      logger.error(
        { err: mpErr, mpPaymentId },
        "Falha ao buscar pagamento no MP",
      );
      return res.status(500).json({ error: "Falha ao verificar pagamento" });
    }

    const serviceId = paymentInfo.external_reference;
    const mpStatus = paymentInfo.status;

    if (mpStatus === "approved" && serviceId) {
      await db
        .update(servicePaymentsTable)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(servicePaymentsTable.serviceId, serviceId))
        .catch((e) => logger.error({ err: e }));
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error({ err: error });
    res.status(500).json({ error: "Erro interno no webhook" });
  }
});

// ── Rate limiting ─────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});

// ── Middlewares ───────────────────────────────────────────────────
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);
app.use("/admin", adminPanelRouter);

export default app;
