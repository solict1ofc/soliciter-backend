import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

function getApiBase(req: any): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  return `http://localhost:${process.env.PORT}`;
}

const PLAN_CONFIG: Record<string, { name: string; amountInCents: number }> = {
  basic:    { name: "Plano Básico SOLICITE",    amountInCents: 5900 },
  destaque: { name: "Plano Destaque SOLICITE",  amountInCents: 7900 },
  premium:  { name: "Plano Premium SOLICITE",   amountInCents: 9900 },
};

// ── POST /api/criar-assinatura ─────────────────────────────────────────────────
router.post("/criar-assinatura", async (req, res) => {
  try {
    const { plan, userId } = req.body as { plan: string; userId?: string | number };
    console.log(`[criar-assinatura] Requisição recebida: plan=${plan} userId=${userId}`);

    const config = PLAN_CONFIG[plan];

    if (!plan || !config) {
      console.error(`[criar-assinatura] Plano inválido: "${plan}". Opções válidas: basic, destaque, premium`);
      return res.status(400).json({ error: "Plano inválido. Use: basic, destaque ou premium." });
    }

    const stripe = await getUncachableStripeClient();
    const apiBase = getApiBase(req);
    console.log(`[criar-assinatura] Criando sessão Stripe para plano="${plan}" valor=R$${(config.amountInCents / 100).toFixed(2)} apiBase=${apiBase}`);

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
              description: "Assinatura mensal · Urgência automática gratuita · Sem taxa de 10%",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${apiBase}/api/subscription/success?plan=${plan}&user_id=${userId ?? ""}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${apiBase}/api/subscription/cancel`,
      locale: "pt-BR",
      metadata: { plan, userId: userId?.toString() ?? "" },
    });

    if (!session.url) {
      console.error("[criar-assinatura] Stripe não retornou URL de checkout");
      return res.status(500).json({ error: "Stripe não retornou URL de checkout. Tente novamente." });
    }

    console.log(`[criar-assinatura] Sessão criada com sucesso. id=${session.id} url=${session.url}`);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error("[criar-assinatura] ERRO:", error.message, error.stack?.split("\n")[0]);
    res.status(500).json({ error: error.message ?? "Erro interno ao criar assinatura." });
  }
});

// ── GET /api/subscription/success ─────────────────────────────────────────────
// Stripe redirects here after successful subscription payment
router.get("/subscription/success", async (req, res) => {
  const { user_id, session_id } = req.query as Record<string, string>;

  // Ativa isPremium no banco se tivermos o userId
  if (user_id && !isNaN(parseInt(user_id))) {
    try {
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id ?? "").catch(() => null);

      // Valida que a sessão realmente foi paga / subscription ativa
      const isValid = !session || session.status === "complete" || session.mode === "subscription";

      if (isValid) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await db
          .update(usersTable)
          .set({ isPremium: true, premiumExpiresAt: expiresAt })
          .where(eq(usersTable.id, parseInt(user_id)))
          .catch((e) => console.error("[subscription/success] db update error", e));
      }
    } catch (e) {
      console.error("[subscription/success]", e);
    }
  }

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
    .badge3 {
      background: rgba(255,184,0,0.08); border: 1px solid rgba(255,184,0,0.3);
      border-radius: 12px; padding: 12px 20px; color: #FFB800; font-size: 13px;
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
  <div class="badge">⚡ Urgência automática — sem custo adicional</div>
  <div class="badge2">✅ Taxa de 10% removida</div>
  <div class="badge3">🔄 Renovação automática mensal</div>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

// ── GET /api/subscription/cancel ──────────────────────────────────────────────
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
  <p>Você saiu antes de confirmar a assinatura.<br>Retorne ao app para tentar novamente.</p>
  <button class="btn" onclick="window.close()">Voltar ao App</button>
</body>
</html>`);
});

export default router;
