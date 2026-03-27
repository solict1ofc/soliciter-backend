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
app.options(/.*/, cors(corsOptions)); // explicit preflight handler (Express 5 requires regex, not "*")

// ── Health check — must be early so Render marks the service as healthy ────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ── DB health check — diagnoses database connectivity ────────────────────────
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
    const result = await pool.query("SELECT NOW() AS ts, current_database() AS db");
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

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.send("API funcionando 🚀");
});

// ── Payouts (raw pg Pool query) ───────────────────────────────────────────────
app.get("/payouts", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM payouts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);

// ── Admin panel simple routes (GET /admin, /admin/pagamentos, /admin/saldo) ───
// Must be before static file serving so these routes take priority over the SPA
app.use("/admin", adminPanelRouter);

// ── Static file serving (production / Render) ─────────────────────────────────
// __dirname = artifacts/api-server/src/ in both Replit and Render (tsx resolves
// import.meta.url to the actual source file path, regardless of cwd).
// So "../../admin/dist/public" reliably resolves to artifacts/admin/dist/public.

const _byDirname = path.resolve(__dirname, "../../admin/dist/public");
const _byCwd     = path.join(process.cwd(), "artifacts/admin/dist/public");
const adminDist  = process.env.ADMIN_DIST_PATH
  ?? (existsSync(_byDirname) ? _byDirname : _byCwd);

const mobileDist = path.resolve(__dirname, "../../mobile/static-build");
const mobileLandingTmpl = path.resolve(
  __dirname,
  "../../mobile/server/templates/landing-page.html"
);

logger.info(
  { adminDist, exists: existsSync(adminDist), __dirname, cwd: process.cwd() },
  "Admin dist path resolved"
);

// Admin SPA — always registered (no existsSync guard to silently skip)
app.use("/admin", express.static(adminDist, { index: false }));

// Serve index.html for /admin and all /admin/* paths (SPA fallback)
app.get(/^\/admin(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(adminDist, "index.html"));
});

// Mobile Expo Go manifests + landing page at /
if (existsSync(mobileDist)) {
  // Platform manifests (consumed by Expo Go on-device)
  app.get(["/", "/manifest"], (req, res, next) => {
    const platform = req.headers["expo-platform"] as string | undefined;
    if (platform === "ios" || platform === "android") {
      const manifestPath = path.join(mobileDist, platform, "manifest.json");
      if (existsSync(manifestPath)) {
        return res
          .set({
            "content-type": "application/json",
            "expo-protocol-version": "1",
            "expo-sfv-version": "0",
          })
          .sendFile(manifestPath);
      }
    }
    next();
  });

  // Landing page (QR code page for browsers)
  if (existsSync(mobileLandingTmpl)) {
    app.get("/", (req, res) => {
      const tmpl = readFileSync(mobileLandingTmpl, "utf-8");
      const proto = (req.headers["x-forwarded-proto"] as string) || "https";
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
      const baseUrl = `${proto}://${host}`;
      const html = tmpl
        .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
        .replace(/EXPS_URL_PLACEHOLDER/g, host)
        .replace(/APP_NAME_PLACEHOLDER/g, "SOLICITE");
      return res.send(html);
    });
  }

  // Static Expo assets (bundles, images, fonts)
  app.use(express.static(mobileDist));

  logger.info({ mobileDist }, "Serving Expo mobile at /");
}

export default app;
