/**
 * Webhook do Mercado Pago
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/webhook
 *   Recebe notificações de pagamento do Mercado Pago.
 *   Quando status = "approved" → marca o pagamento como "retained" no banco.
 *
 * Configure a URL no painel do Mercado Pago → Seu app → Webhooks:
 *   https://<seu-dominio-de-producao>/api/webhook
 *
 * O webhook é a forma mais rápida de confirmação — sem depender de polling.
 */

import axios from "axios";
import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const MP_API = "https://api.mercadopago.com";

function getToken(): string | null {
  return (
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    null
  );
}

// ── POST /api/webhook ──────────────────────────────────────────────────────────
// Recebe notificações do Mercado Pago.
// Responde 200 imediatamente e processa em background para não atrasar o MP.
router.post("/webhook", async (req: Request, res: Response) => {
  res.status(200).json({ received: true });

  try {
    const { type, data, action } = req.body ?? {};

    if (type !== "payment" && action !== "payment.updated") return;
    if (!data?.id) return;

    const mpPaymentId = String(data.id);
    const token       = getToken();

    if (!token) {
      logger.warn("[webhook] Token não configurado — notificação ignorada");
      return;
    }

    const { data: pagamento } = await axios.get(
      `${MP_API}/v1/payments/${mpPaymentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const mpStatus  = pagamento.status as string;
    const serviceId = pagamento.external_reference as string;

    logger.info({ mpPaymentId, serviceId, mpStatus }, "[webhook] Notificação recebida");

    if (mpStatus !== "approved" || !serviceId) return;

    // Pagamento aprovado → reter na plataforma
    const now = new Date();
    await db
      .update(servicePaymentsTable)
      .set({ status: "retained", paidAt: now, retainedAt: now })
      .where(eq(servicePaymentsTable.serviceId, serviceId));

    logger.info(
      { serviceId, mpPaymentId },
      "[webhook] Pagamento aprovado → retido pela plataforma"
    );
  } catch (error: any) {
    logger.error({ err: error?.message }, "[webhook] Erro ao processar notificação");
  }
});

export default router;
