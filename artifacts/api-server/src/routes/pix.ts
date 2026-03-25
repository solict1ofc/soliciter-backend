/**
 * Rotas de pagamento Pix via Mercado Pago (axios)
 *
 * POST /api/pagar
 *   - Recebe: { serviceId, valor }
 *   - Adiciona 5% de taxa
 *   - Cria pagamento Pix via API do Mercado Pago
 *   - Retorna: valorOriginal, valorComTaxa, qrCodeBase64, pixCopiaCola
 *
 * POST /api/webhook
 *   - Recebe notificações do Mercado Pago
 *   - Quando status "approved": marca pagamento e libera o serviço
 */

import axios from "axios";
import { db, servicePaymentsTable, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;
const MP_API = "https://api.mercadopago.com";
const TAXA_PLATAFORMA = 0.05; // 5%

// ── POST /api/pagar ────────────────────────────────────────────────────────────
router.post("/pagar", async (req, res) => {
  try {
    const { serviceId, valor, descricao, emailPagador } = req.body as {
      serviceId: string;
      valor: number;
      descricao?: string;
      emailPagador?: string;
    };

    if (!serviceId || !valor || valor <= 0) {
      return res.status(400).json({
        error: "serviceId e valor são obrigatórios. O valor deve ser maior que zero.",
      });
    }

    const valorOriginal = parseFloat(valor.toString());
    const taxa = parseFloat((valorOriginal * TAXA_PLATAFORMA).toFixed(2));
    const valorComTaxa = parseFloat((valorOriginal + taxa).toFixed(2));

    // Se o ACCESS_TOKEN não estiver configurado, retorna modo teste
    if (!ACCESS_TOKEN) {
      logger.warn({ serviceId }, "[pagar] ACCESS_TOKEN não configurado — MODO TESTE");

      const pixCopiaCola = [
        "00020101021126360014br.gov.bcb.pix",
        `0120solicite.teste@pix.br`,
        `52040000530398654${String(valorComTaxa.toFixed(2).length).padStart(2, "0")}${valorComTaxa.toFixed(2)}`,
        `5802BR5912SOLICITE APP6008GOIANIA`,
        `62${String(serviceId.slice(0, 20).length + 4).padStart(2, "0")}05${String(serviceId.slice(0, 20).length).padStart(2, "0")}${serviceId.slice(0, 20)}`,
        "63040000",
      ].join("");

      // Salva no banco como pagamento de teste
      await db
        .insert(servicePaymentsTable)
        .values({
          serviceId,
          paymentId: `TEST_PIX_${serviceId}_${Date.now()}`,
          amount: Math.round(valorComTaxa * 100),
          status: "test_pending",
          pixCode: pixCopiaCola,
        })
        .onConflictDoUpdate({
          target: servicePaymentsTable.serviceId,
          set: {
            paymentId: `TEST_PIX_${serviceId}_${Date.now()}`,
            amount: Math.round(valorComTaxa * 100),
            status: "test_pending",
            pixCode: pixCopiaCola,
          },
        });

      return res.json({
        isTestMode: true,
        valorOriginal,
        taxa,
        valorComTaxa,
        qrCodeBase64: "",
        pixCopiaCola,
        mensagem: "MODO TESTE — Configure ACCESS_TOKEN para pagamentos reais.",
      });
    }

    // ── Criação real via API do Mercado Pago com axios ─────────────────────────
    const idempotencyKey = `solicite-pagar-${serviceId}`;

    const { data: mpData } = await axios.post(
      `${MP_API}/v1/payments`,
      {
        transaction_amount: valorComTaxa,
        payment_method_id: "pix",
        payer: {
          email: emailPagador || "cliente@solicite.app",
        },
        description: descricao || `Serviço SOLICITE #${serviceId}`,
        external_reference: serviceId,
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "X-Idempotency-Key": idempotencyKey,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentId = String(mpData.id);
    const qrCodeBase64 =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";
    const pixCopiaCola =
      mpData.point_of_interaction?.transaction_data?.qr_code ?? "";

    if (!paymentId || !pixCopiaCola) {
      throw new Error("Resposta inesperada do Mercado Pago — campos ausentes");
    }

    // Salva no banco
    await db
      .insert(servicePaymentsTable)
      .values({
        serviceId,
        paymentId,
        amount: Math.round(valorComTaxa * 100),
        status: "pending",
        pixCode: pixCopiaCola,
      })
      .onConflictDoUpdate({
        target: servicePaymentsTable.serviceId,
        set: {
          paymentId,
          amount: Math.round(valorComTaxa * 100),
          status: "pending",
          pixCode: pixCopiaCola,
        },
      });

    logger.info({ serviceId, paymentId, valorComTaxa }, "[pagar] Pix criado com sucesso");

    return res.json({
      isTestMode: false,
      valorOriginal,
      taxa,
      valorComTaxa,
      qrCodeBase64,
      pixCopiaCola,
      paymentId,
    });
  } catch (error: any) {
    const mpMsg = error.response?.data?.message ?? error.message ?? "Erro desconhecido";
    logger.error({ err: error }, "[pagar] Erro ao criar pagamento Pix");
    return res.status(500).json({ error: `Erro ao criar pagamento Pix: ${mpMsg}` });
  }
});

// ── POST /api/webhook ──────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body ?? {};

    // Mercado Pago envia type="payment" com data.id = id do pagamento
    if (type !== "payment" || !data?.id) {
      return res.json({ received: true, action: "ignored" });
    }

    const mpPaymentId = String(data.id);

    if (!ACCESS_TOKEN) {
      logger.warn("[webhook] ACCESS_TOKEN não configurado — ignorando notificação");
      return res.json({ received: true });
    }

    // Busca detalhes do pagamento na API do Mercado Pago via axios
    const { data: paymentInfo } = await axios.get(
      `${MP_API}/v1/payments/${mpPaymentId}`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );

    const mpStatus = paymentInfo.status;           // "approved", "pending", etc.
    const serviceId = paymentInfo.external_reference; // nosso ID do serviço

    logger.info({ mpPaymentId, serviceId, mpStatus }, "[webhook] Notificação Mercado Pago");

    if (mpStatus === "approved" && serviceId) {
      // ── 1. Marca pagamento como aprovado no banco ──────────────────────────
      await db
        .update(servicePaymentsTable)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(servicePaymentsTable.serviceId, serviceId));

      // ── 2. Libera o serviço (status disponível no banco) ──────────────────
      await db
        .insert(servicesTable)
        .values({
          serviceId,
          status: "disponivel",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: servicesTable.serviceId,
          set: { status: "disponivel", updatedAt: new Date() },
        });

      logger.info({ serviceId, mpPaymentId }, "[webhook] Pagamento aprovado — serviço liberado!");

      return res.json({
        received: true,
        action: "payment_approved",
        serviceId,
        mpPaymentId,
      });
    }

    return res.json({ received: true, action: "status_ignored", mpStatus });
  } catch (error: any) {
    logger.error({ err: error }, "[webhook] Erro ao processar notificação");
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
});

export default router;
