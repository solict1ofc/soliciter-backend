import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { getStripePublishableKey, getUncachableStripeClient } from "../stripeClient";

const router = Router();

function getApiBase(req: any): string {
  // 1. Explicit override (works on any platform)
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  // 2. Replit
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  // 3. Render
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  // 4. Derive from request (works behind any proxy)
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "http";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${process.env.PORT}`;
  return `${proto}://${host}`;
}

// ── POST /api/payment/create-checkout ─────────────────────────────────────────
// Creates a Stripe Checkout Session for a service payment
router.post("/payment/create-checkout", async (req, res) => {
  try {
    const { serviceId, amountInCents, title, urgent } = req.body as {
      serviceId: string;
      amountInCents: number;
      title?: string;
      urgent?: boolean;
    };

    // Stripe minimum: payment must be at least ~$0.50 USD — in BRL that's ~R$3.00
    // We enforce R$5.00 minimum for safety margin
    const MINIMUM_CENTS = 500; // R$5.00
    if (!serviceId || !amountInCents || amountInCents < MINIMUM_CENTS) {
      console.error(`[payment/create-checkout] Valor inválido: ${amountInCents} centavos (mínimo ${MINIMUM_CENTS})`);
      return res.status(400).json({
        error: `Valor mínimo para pagamento é R$ ${(MINIMUM_CENTS / 100).toFixed(2).replace(".", ",")}`,
      });
    }

    const stripe = await getUncachableStripeClient();
    const publishableKey = await getStripePublishableKey();
    const apiBase = getApiBase(req);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: amountInCents,
            product_data: {
              name: title || "Serviço SOLICITE",
              description: urgent ? "⚡ Serviço urgente (+R$10,00)" : "Pagamento em custódia — liberado após conclusão",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${apiBase}/api/payment/success?service_id=${serviceId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${apiBase}/api/payment/cancel?service_id=${serviceId}`,
      metadata: { serviceId },
      locale: "pt-BR",
    });

    // Upsert pending payment record
    await db
      .insert(servicePaymentsTable)
      .values({
        serviceId,
        sessionId: session.id,
        amount: amountInCents,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: servicePaymentsTable.serviceId,
        set: { sessionId: session.id, amount: amountInCents, status: "pending" },
      });

    res.json({ url: session.url, sessionId: session.id, publishableKey });
  } catch (error: any) {
    console.error("[payment/create-checkout]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/payment/status/:serviceId ────────────────────────────────────────
// Returns payment status for a given service
router.get("/payment/status/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;

    const [payment] = await db
      .select()
      .from(servicePaymentsTable)
      .where(eq(servicePaymentsTable.serviceId, serviceId))
      .limit(1);

    if (!payment) {
      return res.json({ status: "not_found" });
    }

    // If still pending, also verify live with Stripe
    if (payment.status === "pending" && payment.sessionId) {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(payment.sessionId);
      if (session.payment_status === "paid") {
        await db
          .update(servicePaymentsTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(servicePaymentsTable.serviceId, serviceId));
        return res.json({ status: "paid", sessionId: payment.sessionId });
      }
    }

    res.json({ status: payment.status, sessionId: payment.sessionId });
  } catch (error: any) {
    console.error("[payment/status]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/payment/success ───────────────────────────────────────────────────
// Stripe redirects here after successful payment
router.get("/payment/success", async (req, res) => {
  const { service_id, session_id } = req.query as Record<string, string>;

  try {
    if (service_id && session_id) {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status === "paid") {
        await db
          .update(servicePaymentsTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(servicePaymentsTable.serviceId, service_id))
          .catch(() => {});
      }
    }
  } catch (e) {
    console.error("[payment/success]", e);
  }

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pagamento Confirmado — SOLICITE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0A0F; color: #fff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center; gap: 16px;
    }
    .icon { font-size: 72px; }
    h1 { color: #00D4FF; font-size: 26px; font-weight: 700; }
    p { color: #aaa; font-size: 15px; line-height: 1.6; }
    .badge {
      background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3);
      border-radius: 12px; padding: 12px 20px; color: #00D4FF; font-size: 13px;
    }
    .countdown { color: #555; font-size: 13px; margin-top: 4px; }
    .btn {
      background: #00D4FF; color: #000; border: none; border-radius: 14px;
      padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px; -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div class="icon">✅</div>
  <h1>Pagamento Confirmado!</h1>
  <p>Sua solicitação foi publicada com sucesso.<br>Prestadores já podem vê-la no marketplace.</p>
  <div class="badge">🔒 Valor em custódia — liberado após conclusão</div>
  <button class="btn" onclick="closeAndReturn()">Voltar ao App</button>
  <p class="countdown" id="cd">Fechando em 4s...</p>
  <script>
    function closeAndReturn() {
      window.close();
      // Fallback: if window.close() didn't work (e.g. same-tab redirect flow),
      // navigate to the app root after a brief delay
      setTimeout(function() { history.back(); }, 300);
    }
    var t = 4;
    var iv = setInterval(function() {
      t--;
      var el = document.getElementById('cd');
      if (el) el.textContent = t > 0 ? 'Fechando em ' + t + 's...' : 'Fechando...';
      if (t <= 0) { clearInterval(iv); closeAndReturn(); }
    }, 1000);
  </script>
</body>
</html>`);
});

// ── GET /api/payment/cancel ────────────────────────────────────────────────────
// Stripe redirects here when user cancels payment
router.get("/payment/cancel", async (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pagamento Cancelado — SOLICITE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0A0F; color: #fff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center; gap: 16px;
    }
    .icon { font-size: 72px; }
    h1 { color: #FF3B5C; font-size: 26px; font-weight: 700; }
    p { color: #aaa; font-size: 15px; line-height: 1.6; }
    .btn {
      background: #00D4FF; color: #000; border: none; border-radius: 14px;
      padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="icon">❌</div>
  <h1>Pagamento Cancelado</h1>
  <p>O pagamento foi cancelado.<br>Sua solicitação continua salva — retorne ao app para tentar novamente.</p>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

export default router;
