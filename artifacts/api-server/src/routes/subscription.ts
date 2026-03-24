import { Router } from "express";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

function getApiBase(req: any): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return `http://localhost:${process.env.PORT}`;
}

const PLAN_CONFIG: Record<string, { name: string; amountInCents: number }> = {
  basic: {
    name: "Plano Básico SOLICITE",
    amountInCents: 5900,
  },
  destaque: {
    name: "Plano Destaque SOLICITE",
    amountInCents: 7900,
  },
  premium: {
    name: "Plano Premium SOLICITE",
    amountInCents: 9900,
  },
};

// ── POST /api/criar-assinatura ─────────────────────────────────────────────────
// Creates a Stripe Checkout Session (subscription mode) and returns the URL
router.post("/criar-assinatura", async (req, res) => {
  try {
    const { plan } = req.body as { plan: string };
    const config = PLAN_CONFIG[plan];

    if (!plan || !config) {
      return res.status(400).json({ error: "Plano inválido. Use: basic, destaque ou premium." });
    }

    const stripe = await getUncachableStripeClient();
    const apiBase = getApiBase(req);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: config.amountInCents,
            recurring: { interval: "month" },
            product_data: {
              name: config.name,
              description: "Assinatura mensal · Sem taxa de 10% da plataforma",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${apiBase}/api/subscription/success?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${apiBase}/api/subscription/cancel`,
      locale: "pt-BR",
      metadata: { plan },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[criar-assinatura]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/subscription/success ─────────────────────────────────────────────
// Stripe redirects here after successful subscription
router.get("/subscription/success", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Assinatura Ativada — SOLICITE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0A0A0F; color: #fff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px; text-align: center; gap: 18px;
    }
    .icon { font-size: 72px; }
    h1 { color: #00D4FF; font-size: 26px; font-weight: 700; }
    p { color: #aaa; font-size: 15px; line-height: 1.6; }
    .badge {
      background: rgba(0,212,255,0.1); border: 1px solid rgba(0,212,255,0.3);
      border-radius: 12px; padding: 12px 20px; color: #00D4FF; font-size: 14px;
    }
    .badge2 {
      background: rgba(0,230,118,0.08); border: 1px solid rgba(0,230,118,0.3);
      border-radius: 12px; padding: 12px 20px; color: #00E676; font-size: 13px;
    }
    .btn {
      background: #00D4FF; color: #000; border: none; border-radius: 14px;
      padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px; -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div class="icon">🎉</div>
  <h1>Assinatura Ativada!</h1>
  <p>Seu plano foi ativado com sucesso.<br>Aproveite todos os benefícios da plataforma.</p>
  <div class="badge">⚡ Taxa de 10% da plataforma removida</div>
  <div class="badge2">✅ Assinatura renovada automaticamente todo mês</div>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

// ── GET /api/subscription/cancel ──────────────────────────────────────────────
// Stripe redirects here when user cancels subscription checkout
router.get("/subscription/cancel", (_req, res) => {
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
      min-height: 100vh; padding: 24px; text-align: center; gap: 18px;
    }
    .icon { font-size: 72px; }
    h1 { color: #FF3B5C; font-size: 26px; font-weight: 700; }
    p { color: #aaa; font-size: 15px; line-height: 1.6; }
    .btn {
      background: #00D4FF; color: #000; border: none; border-radius: 14px;
      padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer;
      margin-top: 8px; -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div class="icon">↩️</div>
  <h1>Assinatura Não Concluída</h1>
  <p>Você saiu antes de confirmar a assinatura.<br>Seu plano atual continua ativo — retorne ao app para tentar novamente.</p>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

export default router;
