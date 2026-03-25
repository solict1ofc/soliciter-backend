/**
 * Pagamentos Pix via Mercado Pago
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/create-payment
 *   Recebe: valor, descricao, email
 *   Gera pagamento Pix no Mercado Pago
 *   Retorna: QR Code (base64 + copia-e-cola) + link de pagamento
 *
 * POST /api/pagar
 *   Igual ao create-payment, porém adiciona 5% de taxa automaticamente.
 *   Recebe também serviceId para rastrear o pedido.
 *
 * POST /api/webhook
 *   Recebe notificações do Mercado Pago.
 *   Quando status = "approved" → salva como "pago" e libera o serviço.
 */

import axios, { type AxiosError } from "axios";
import { db, servicePaymentsTable, servicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

// ── Configuração ──────────────────────────────────────────────────────────────
const MP_API        = "https://api.mercadopago.com";
const TAXA_5PCT     = 0.05;

/**
 * Retorna o Access Token do Mercado Pago somente se tiver formato válido.
 * Tokens válidos: "TEST-..." (sandbox) ou "APP_USR-..." (produção).
 * Tokens inválidos → retorna null → modo teste ativado automaticamente.
 */
function getToken(): string | null {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return null;
  if (token.startsWith("TEST-") || token.startsWith("APP_USR-")) return token;
  logger.warn(
    "[pix] Token inválido (não começa com TEST- ou APP_USR-). Ativando MODO TESTE."
  );
  return null;
}

/** Cabeçalhos padrão para chamadas autenticadas ao Mercado Pago */
function mpHeaders(token: string, idempotencyKey?: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
  };
}

/** Extrai mensagem de erro de respostas axios do Mercado Pago */
function mpErrorMessage(error: unknown): string {
  const axiosErr = error as AxiosError<{ message?: string; cause?: string }>;
  return (
    axiosErr.response?.data?.message ??
    axiosErr.response?.data?.cause ??
    (error instanceof Error ? error.message : "Erro desconhecido")
  );
}

// ── POST /api/create-payment ──────────────────────────────────────────────────
/**
 * Cria um pagamento Pix no Mercado Pago.
 *
 * Body: { valor: number, descricao: string, email: string, serviceId?: string }
 *
 * Resposta:
 *   {
 *     paymentId, status,
 *     valor,
 *     qrCodeBase64,      // imagem PNG em base64 para exibir
 *     qrCodeCopiaCola,   // string para copiar e colar no banco
 *     linkPagamento,     // URL da página de pagamento Pix (MP)
 *     isTestMode         // true quando ACCESS_TOKEN não está configurado
 *   }
 */
router.post("/create-payment", async (req: Request, res: Response) => {
  const { valor, descricao, email, serviceId } = req.body as {
    valor: number;
    descricao?: string;
    email?: string;
    serviceId?: string;
  };

  // Validação de entrada
  if (!valor || Number(valor) <= 0) {
    return res.status(400).json({ error: "O campo 'valor' é obrigatório e deve ser maior que zero." });
  }

  const valorFinal  = parseFloat(Number(valor).toFixed(2));
  const referencia  = serviceId ?? `pay_${Date.now()}`;
  const descricaoFinal = descricao?.trim() || "Serviço SOLICITE";
  const emailPagador   = email?.trim()    || "cliente@solicite.app";

  const token = getToken();

  // ── Modo Teste (sem Access Token) ─────────────────────────────────────────
  if (!token) {
    logger.warn({ referencia }, "[create-payment] ACCESS_TOKEN ausente — MODO TESTE");

    const qrCodeCopiaCola = `00020101021126330014br.gov.bcb.pix0111soliciteteste52040000530398654${valorFinal.toFixed(2).length.toString().padStart(2,"0")}${valorFinal.toFixed(2)}5802BR5912SOLICITEAPP6008Goiania6304ABCD`;
    const testPaymentId   = `TEST_${referencia}_${Date.now()}`;

    await db.insert(servicePaymentsTable).values({
      serviceId: referencia,
      paymentId: testPaymentId,
      amount:    Math.round(valorFinal * 100),
      status:    "test_pending",
      pixCode:   qrCodeCopiaCola,
    }).onConflictDoUpdate({
      target: servicePaymentsTable.serviceId,
      set: { paymentId: testPaymentId, status: "test_pending", pixCode: qrCodeCopiaCola },
    });

    return res.status(201).json({
      paymentId:       testPaymentId,
      status:          "pending",
      valor:           valorFinal,
      qrCodeBase64:    "",
      qrCodeCopiaCola,
      linkPagamento:   null,
      isTestMode:      true,
      aviso:           "ACCESS_TOKEN não configurado. Use um token real para cobranças reais.",
    });
  }

  // ── Produção: chama a API do Mercado Pago ─────────────────────────────────
  try {
    const idempotencyKey = `solicite-cp-${referencia}`;

    const { data: mpPay } = await axios.post(
      `${MP_API}/v1/payments`,
      {
        transaction_amount: valorFinal,
        payment_method_id:  "pix",
        description:        descricaoFinal,
        external_reference: referencia,
        payer: { email: emailPagador },
      },
      { headers: mpHeaders(token, idempotencyKey) }
    );

    const paymentId       = String(mpPay.id);
    const qrCodeBase64    = mpPay.point_of_interaction?.transaction_data?.qr_code_base64    ?? "";
    const qrCodeCopiaCola = mpPay.point_of_interaction?.transaction_data?.qr_code           ?? "";
    const linkPagamento   = mpPay.point_of_interaction?.transaction_data?.ticket_url        ?? null;

    if (!qrCodeCopiaCola) {
      throw new Error("Mercado Pago não retornou o código Pix. Verifique o Access Token.");
    }

    // Persiste no banco (escrow — dinheiro fica na plataforma)
    await db.insert(servicePaymentsTable).values({
      serviceId: referencia,
      paymentId,
      amount:    Math.round(valorFinal * 100),
      status:    "pending",
      pixCode:   qrCodeCopiaCola,
    }).onConflictDoUpdate({
      target: servicePaymentsTable.serviceId,
      set: { paymentId, amount: Math.round(valorFinal * 100), status: "pending", pixCode: qrCodeCopiaCola },
    });

    logger.info({ referencia, paymentId, valorFinal }, "[create-payment] Pix criado");

    return res.status(201).json({
      paymentId,
      status:          mpPay.status,  // "pending" enquanto aguarda pagamento
      valor:           valorFinal,
      qrCodeBase64,
      qrCodeCopiaCola,
      linkPagamento,   // URL para abrir o Pix no browser
      isTestMode:      false,
    });
  } catch (error) {
    logger.error({ err: error }, "[create-payment] Falha ao criar pagamento");
    return res.status(502).json({ error: mpErrorMessage(error) });
  }
});

// ── POST /api/pagar ────────────────────────────────────────────────────────────
/**
 * Igual ao /create-payment porém aplica automaticamente 5% de taxa.
 *
 * Body: { serviceId, valor, descricao?, emailPagador? }
 *
 * Resposta extra: valorOriginal, taxa, valorComTaxa
 */
router.post("/pagar", async (req: Request, res: Response) => {
  const { serviceId, valor, descricao, emailPagador } = req.body as {
    serviceId: string;
    valor: number;
    descricao?: string;
    emailPagador?: string;
  };

  if (!serviceId || !valor || Number(valor) <= 0) {
    return res.status(400).json({ error: "'serviceId' e 'valor' são obrigatórios." });
  }

  const valorOriginal = parseFloat(Number(valor).toFixed(2));
  const taxa          = parseFloat((valorOriginal * TAXA_5PCT).toFixed(2));
  const valorComTaxa  = parseFloat((valorOriginal + taxa).toFixed(2));

  // Reutiliza a lógica do create-payment passando o valor com taxa
  req.body = {
    valor:     valorComTaxa,
    descricao: descricao ?? `Serviço SOLICITE #${serviceId}`,
    email:     emailPagador,
    serviceId,
  };

  // Chama o handler do /create-payment internamente via axios (localhost)
  // Para simplicidade, duplicamos a lógica aqui com o valor já calculado.
  const token = getToken();

  if (!token) {
    return res.status(201).json({
      isTestMode:    true,
      valorOriginal,
      taxa,
      valorComTaxa,
      qrCodeBase64:  "",
      pixCopiaCola:  `TESTE_PIX_${serviceId}_${Date.now()}`,
      aviso:         "ACCESS_TOKEN não configurado. Use um token real para cobranças reais.",
    });
  }

  try {
    const idempotencyKey = `solicite-pagar-${serviceId}`;
    const { data: mpPay } = await axios.post(
      `${MP_API}/v1/payments`,
      {
        transaction_amount: valorComTaxa,
        payment_method_id:  "pix",
        description:        descricao ?? `Serviço SOLICITE #${serviceId}`,
        external_reference: serviceId,
        payer: { email: emailPagador ?? "cliente@solicite.app" },
      },
      { headers: mpHeaders(token, idempotencyKey) }
    );

    const paymentId      = String(mpPay.id);
    const qrCodeBase64   = mpPay.point_of_interaction?.transaction_data?.qr_code_base64 ?? "";
    const pixCopiaCola   = mpPay.point_of_interaction?.transaction_data?.qr_code        ?? "";
    const linkPagamento  = mpPay.point_of_interaction?.transaction_data?.ticket_url     ?? null;

    await db.insert(servicePaymentsTable).values({
      serviceId,
      paymentId,
      amount:  Math.round(valorComTaxa * 100),
      status:  "pending",
      pixCode: pixCopiaCola,
    }).onConflictDoUpdate({
      target: servicePaymentsTable.serviceId,
      set: { paymentId, amount: Math.round(valorComTaxa * 100), status: "pending", pixCode: pixCopiaCola },
    });

    logger.info({ serviceId, paymentId, valorOriginal, taxa, valorComTaxa }, "[pagar] Pix criado");

    return res.status(201).json({
      isTestMode: false,
      valorOriginal,
      taxa,
      valorComTaxa,
      paymentId,
      qrCodeBase64,
      pixCopiaCola,
      linkPagamento,
    });
  } catch (error) {
    logger.error({ err: error }, "[pagar] Falha");
    return res.status(502).json({ error: mpErrorMessage(error) });
  }
});

// ── POST /api/webhook ──────────────────────────────────────────────────────────
/**
 * Recebe notificações do Mercado Pago via webhook.
 *
 * Configure a URL no painel MP → Seu app → Webhooks:
 *   https://<seu-dominio>/api/webhook
 *
 * Quando status = "approved":
 *   1. Salva pagamento como "pago" no banco
 *   2. Libera o serviço automaticamente
 */
router.post("/webhook", async (req: Request, res: Response) => {
  // Sempre responde 200 imediatamente para o Mercado Pago não retentar
  res.status(200).json({ received: true });

  try {
    const { type, data, action } = req.body ?? {};

    // Ignora eventos que não são de pagamento
    if (type !== "payment" && action !== "payment.updated") return;
    if (!data?.id) return;

    const mpPaymentId = String(data.id);
    const token       = getToken();

    if (!token) {
      logger.warn("[webhook] ACCESS_TOKEN ausente — notificação ignorada");
      return;
    }

    // Busca os detalhes do pagamento na API do Mercado Pago
    const { data: pagamento } = await axios.get(
      `${MP_API}/v1/payments/${mpPaymentId}`,
      { headers: mpHeaders(token) }
    );

    const status    = pagamento.status as string;           // "approved" | "pending" | ...
    const serviceId = pagamento.external_reference as string;

    logger.info({ mpPaymentId, serviceId, status }, "[webhook] Notificação recebida");

    if (status !== "approved" || !serviceId) return;

    // ── Pagamento aprovado: salva como "pago" ─────────────────────────────────
    await db
      .update(servicePaymentsTable)
      .set({ status: "pago", paidAt: new Date() })
      .where(eq(servicePaymentsTable.serviceId, serviceId));

    // ── Libera o serviço automaticamente ─────────────────────────────────────
    await db
      .insert(servicesTable)
      .values({ serviceId, status: "disponivel", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: servicesTable.serviceId,
        set: { status: "disponivel", updatedAt: new Date() },
      });

    logger.info(
      { serviceId, mpPaymentId },
      "[webhook] Pagamento aprovado → status=pago, serviço liberado"
    );
  } catch (error) {
    // Não relança — resposta 200 já foi enviada ao MP
    logger.error({ err: error }, "[webhook] Erro interno ao processar notificação");
  }
});

export default router;
