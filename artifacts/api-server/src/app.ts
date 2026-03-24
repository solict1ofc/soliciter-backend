import { db, servicePaymentsTable, usersTable } from "@workspace/db";
import cors from "cors";
import { eq } from "drizzle-orm";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { getUncachableStripeClient } from "./stripeClient";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Stripe webhook — must be BEFORE express.json() ────────────────────────────
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body.toString());
      const session = event.data?.object;

      // ── Service payment completed ──────────────────────────────────────────
      if (event.type === "checkout.session.completed" && session?.mode === "payment") {
        const serviceId = session?.metadata?.serviceId;
        if (serviceId && session?.payment_status === "paid") {
          await db
            .update(servicePaymentsTable)
            .set({ status: "paid", paidAt: new Date() })
            .where(eq(servicePaymentsTable.serviceId, serviceId))
            .catch(() => {});
        }
      }

      // ── Subscription checkout completed ────────────────────────────────────
      if (event.type === "checkout.session.completed" && session?.mode === "subscription") {
        const userId = session?.metadata?.userId;
        if (userId && !isNaN(parseInt(userId))) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          await db
            .update(usersTable)
            .set({ isPremium: true, premiumExpiresAt: expiresAt })
            .where(eq(usersTable.id, parseInt(userId)))
            .catch((e) => logger.error({ err: e }, "Failed to activate premium via webhook"));
        }
      }

      // ── Subscription invoice paid (renewal) ────────────────────────────────
      if (event.type === "invoice.payment_succeeded") {
        const subscriptionId = session?.subscription;
        if (subscriptionId) {
          try {
            const stripe = await getUncachableStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
            const userId = (subscription.metadata as any)?.userId;
            if (userId && !isNaN(parseInt(userId))) {
              const expiresAt = new Date();
              expiresAt.setMonth(expiresAt.getMonth() + 1);
              await db
                .update(usersTable)
                .set({ isPremium: true, premiumExpiresAt: expiresAt })
                .where(eq(usersTable.id, parseInt(userId)))
                .catch(() => {});
            }
          } catch (e) {
            logger.error({ err: e }, "Failed to renew premium via webhook");
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Webhook error");
      res.status(400).json({ error: "Webhook processing failed" });
    }
  },
);

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

app.use("/api", router);

export default app;
