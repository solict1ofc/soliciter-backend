import { db, servicesTable } from "@workspace/db";
import { Router } from "express";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

function getApiBase(req: any): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return `http://localhost:${process.env.PORT}`;
}

const PLAN_PRICES: Record<string, number> = {
  basic: 8000,
  destaque: 9900,
  premium: 12000,
};

const PLAN_NAMES: Record<string, string> = {
  basic: "Plano Básico",
  destaque: "Plano Destaque",
  premium: "Plano Premium",
};

router.post("/iniciar-servico", async (req, res) => {
  try {
    const { serviceId } = req.body as { serviceId?: string };

    if (!serviceId) {
      return res.status(400).json({ error: "serviceId é obrigatório" });
    }

    const now = new Date();

    await db
      .insert(servicesTable)
      .values({
        serviceId,
        status: "em_andamento",
        startedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: servicesTable.serviceId,
        set: {
          status: "em_andamento",
          startedAt: now,
          updatedAt: now,
        },
      });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[iniciar-servico]", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/criar-assinatura", async (req, res) => {
  try {
    const { plan } = req.body as { plan?: string };

    if (!plan || !PLAN_PRICES[plan]) {
      return res.status(400).json({ error: "Plano inválido. Use: basic, destaque ou premium" });
    }

    const amountInCents = PLAN_PRICES[plan];
    const planName = PLAN_NAMES[plan];
    const apiBase = getApiBase(req);

    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: amountInCents,
            product_data: {
              name: `${planName} — SOLICITE`,
              description: "Assinatura mensal da plataforma SOLICITE",
            },
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${apiBase}/api/assinatura/sucesso?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${apiBase}/api/assinatura/cancelado`,
      metadata: { plan },
      locale: "pt-BR",
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[criar-assinatura]", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/assinatura/sucesso", async (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Assinatura Confirmada — SOLICITE</title>
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
    .btn {
      background: #00D4FF; color: #000; border: none; border-radius: 14px;
      padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="icon">✅</div>
  <h1>Assinatura Confirmada!</h1>
  <p>Seu plano foi ativado com sucesso.<br>Aproveite todos os benefícios!</p>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

router.get("/assinatura/cancelado", async (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Assinatura Cancelada — SOLICITE</title>
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
  <h1>Assinatura Cancelada</h1>
  <p>O pagamento da assinatura foi cancelado.<br>Você pode tentar novamente a qualquer momento.</p>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

export default router;
