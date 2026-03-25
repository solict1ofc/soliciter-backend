import { db, servicePaymentsTable, usersTable } from "@workspace/db";
import cors from "cors";
import { eq } from "drizzle-orm";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { getUncachableStripeClient } from "./stripeClient";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Stripe webhook — must be BEFORE express.json() ────────────────────────────
// Raw body needed for signature verification
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    try {
      const stripe = await getUncachableStripeClient();

      if (webhookSecret && sig) {
        // Production path: verify Stripe signature (tamper-proof)
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (sigErr: any) {
          logger.warn({ err: sigErr }, "Stripe webhook signature verification failed");
          return res.status(400).json({ error: "Webhook signature invalid" });
        }
      } else {
        // Development path: no secret configured — parse but log warning
        // In production you MUST set STRIPE_WEBHOOK_SECRET
        if (process.env.NODE_ENV === "production") {
          logger.error("STRIPE_WEBHOOK_SECRET not set in production — rejecting webhook");
          return res.status(400).json({ error: "Webhook secret not configured" });
        }
        logger.warn("STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)");
        event = JSON.parse(req.body.toString());
      }
    } catch (parseErr: any) {
      logger.error({ err: parseErr }, "Failed to parse webhook body");
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    try {
      const session = event.data?.object;

      // ── Service payment completed (one-time checkout) ──────────────────────
      if (event.type === "checkout.session.completed" && session?.mode === "payment") {
        const serviceId = session?.metadata?.serviceId;
        if (serviceId && session?.payment_status === "paid") {
          logger.info({ serviceId }, "Webhook: service payment confirmed");
          await db
            .update(servicePaymentsTable)
            .set({ status: "paid", paidAt: new Date() })
            .where(eq(servicePaymentsTable.serviceId, serviceId))
            .catch((e) => logger.error({ err: e }, "Failed to update service payment"));
        }
      }

      // ── Subscription checkout completed ────────────────────────────────────
      if (event.type === "checkout.session.completed" && session?.mode === "subscription") {
        const userId = session?.metadata?.userId;
        if (userId && !isNaN(parseInt(userId))) {
          logger.info({ userId }, "Webhook: subscription activated");
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          await db
            .update(usersTable)
            .set({ isPremium: true, premiumExpiresAt: expiresAt })
            .where(eq(usersTable.id, parseInt(userId)))
            .catch((e) => logger.error({ err: e }, "Failed to activate premium via webhook"));
        }
      }

      // ── Subscription renewal (invoice paid) ───────────────────────────────
      if (event.type === "invoice.payment_succeeded") {
        const subscriptionId = session?.subscription;
        if (subscriptionId) {
          try {
            const stripe = await getUncachableStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
            const userId = (subscription.metadata as any)?.userId;
            if (userId && !isNaN(parseInt(userId))) {
              logger.info({ userId }, "Webhook: subscription renewed");
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 1);
              await db
                .update(usersTable)
                .set({ isPremium: true, premiumExpiresAt: expiresAt })
                .where(eq(usersTable.id, parseInt(userId)))
                .catch((e) => logger.error({ err: e }, "Failed to renew premium via webhook"));
            }
          } catch (e) {
            logger.error({ err: e }, "Failed to process subscription renewal");
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Webhook processing error");
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Auth endpoints: 10 requests per 15 minutes per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
  skip: () => process.env.NODE_ENV === "development", // skip in dev for easier testing
});

// General API: 100 requests per minute per IP
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

// Apply rate limiting
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);

export default app;
