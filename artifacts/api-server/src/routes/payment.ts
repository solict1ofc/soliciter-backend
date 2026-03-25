import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { logger } from "../lib/logger";

const router = Router();

const PLATFORM_FEE_RATE = 0.10;

// ── Mercado Pago client ────────────────────────────────────────────────────────
// Aceita MP_ACCESS_TOKEN (preferência) ou MERCADO_PAGO_ACCESS_TOKEN (legado).
// Lança erro na inicialização se a variável não estiver configurada.
function getMpClient(): MercadoPagoConfig {
  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken || accessToken.trim() === "") {
    throw new Error(
      "Mercado Pago não configurado. " +
      "Defina a variável de ambiente MP_ACCESS_TOKEN com seu Access Token de produção."
    );
  }

  return new MercadoPagoConfig({ accessToken: accessToken.trim() });
}

// ── POST /api/payment/create-payment ──────────────────────────────────────────
// Cria um pagamento PIX real via Mercado Pago destinado à conta da plataforma.
// O valor fica RETIDO até o serviço ser finalizado e liberado (split 90/10).
router.post("/payment/create-payment", async (req, res) => {
  try {
    const { serviceId, amountInCents, title, userEmail } = req.body as {
      serviceId: string;
      amountInCents: number;
      title?: string;
      userEmail?: string;
    };

    if (!serviceId || !amountInCents || amountInCents < 100) {
      return res.status(400).json({
        error: "Dados inválidos. Valor mínimo para pagamento é R$ 1,00.",
      });
    }

    if (!userEmail || !userEmail.includes("@")) {
      return res.status(400).json({
        error: "E-mail do pagador é obrigatório para pagamento PIX.",
      });
    }

    const amountInReais = amountInCents / 100;
    const client = getMpClient();
    const payment = new Payment(client);

    const result = await payment.create({
      body: {
        transaction_amount: amountInReais,
        payment_method_id: "pix",
        payer: {
          email: userEmail,
        },
        description: title || "Serviço SOLICITE",
        external_reference: serviceId,
      },
      requestOptions: {
        idempotencyKey: `solicite-service-${serviceId}`,
      },
    });

    const paymentId = result.id?.toString();
    const qrCode   = result.point_of_interaction?.transaction_data?.qr_code_base64;
    const pixCode  = result.point_of_interaction?.transaction_data?.qr_code;

    if (!paymentId || !pixCode) {
      logger.error({ result }, "[payment] Resposta incompleta do Mercado Pago");
      throw new Error("Resposta inválida do Mercado Pago — tente novamente.");
    }

    await db
      .insert(servicePaymentsTable)
      .values({
        serviceId,
        paymentId,
        amount: amountInCents,
        status: "pending",
        pixCode,
      })
      .onConflictDoUpdate({
        target: servicePaymentsTable.serviceId,
        set: {
          paymentId,
          amount: amountInCents,
          status: "pending",
          pixCode,
        },
      });

    logger.info(
      { serviceId, paymentId, amountInReais },
      "[payment] PIX criado → conta plataforma"
    );

    return res.json({
      paymentId,
      qrCode:   qrCode  ?? "",
      pixCode,
      isTestMode: false,
    });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[payment/create-payment] Erro");
    return res.status(500).json({
      error: error.message || "Erro ao criar pagamento PIX. Verifique a configuração do Mercado Pago.",
    });
  }
});

// ── GET /api/payment/status/:serviceId ────────────────────────────────────────
// Consulta o status real do pagamento na API do Mercado Pago.
// Só marca como "retained" quando MP retorna status = "approved".
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

    // Já finalizado — retorna direto sem consultar MP
    if (payment.status === "retained" || payment.status === "released") {
      return res.json({ status: payment.status });
    }

    // Legado: "paid" → migrar para "retained"
    if (payment.status === "paid") {
      const now = new Date();
      await db
        .update(servicePaymentsTable)
        .set({ status: "retained", retainedAt: now })
        .where(eq(servicePaymentsTable.serviceId, serviceId));
      return res.json({ status: "retained" });
    }

    // Status pendente → consultar Mercado Pago em tempo real
    if (!payment.paymentId) {
      return res.json({ status: payment.status });
    }

    const client = getMpClient();
    const mpPayment = new Payment(client);
    const paymentInfo = await mpPayment.get({ id: parseInt(payment.paymentId) });

    logger.info(
      { serviceId, paymentId: payment.paymentId, mpStatus: paymentInfo.status },
      "[payment] Status consultado no MP"
    );

    if (paymentInfo.status === "approved") {
      const now = new Date();
      await db
        .update(servicePaymentsTable)
        .set({ status: "retained", paidAt: now, retainedAt: now })
        .where(eq(servicePaymentsTable.serviceId, serviceId));

      logger.info(
        { serviceId, paymentId: payment.paymentId },
        "[payment] Pagamento aprovado → retido pela plataforma"
      );
      return res.json({ status: "retained" });
    }

    // "cancelled", "rejected" etc.
    if (
      paymentInfo.status === "cancelled" ||
      paymentInfo.status === "rejected" ||
      paymentInfo.status === "refunded"
    ) {
      await db
        .update(servicePaymentsTable)
        .set({ status: paymentInfo.status as string })
        .where(eq(servicePaymentsTable.serviceId, serviceId));
      return res.json({ status: paymentInfo.status });
    }

    // "pending", "in_process" etc. — ainda aguardando
    return res.json({ status: payment.status, mpStatus: paymentInfo.status });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[payment/status] Erro");
    return res.status(500).json({ error: error.message });
  }
});

// ── POST /api/payment/release/:serviceId ──────────────────────────────────────
// Libera o pagamento retido após conclusão do serviço.
// Split: 90% prestador / 10% plataforma.
router.post("/payment/release/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { providerId } = req.body as { providerId?: string };

    const [payment] = await db
      .select()
      .from(servicePaymentsTable)
      .where(eq(servicePaymentsTable.serviceId, serviceId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: "Pagamento não encontrado." });
    }

    // Idempotente: já liberado
    if (payment.status === "released") {
      return res.json({
        ok: true,
        alreadyReleased: true,
        providerAmount: payment.providerAmount,
        platformAmount: payment.platformAmount,
      });
    }

    if (payment.status !== "retained") {
      return res.status(400).json({
        error: `Pagamento com status "${payment.status}" não pode ser liberado. Apenas pagamentos retidos podem ser liberados.`,
      });
    }

    const totalAmount    = payment.amount;
    const platformAmount = Math.round(totalAmount * PLATFORM_FEE_RATE);
    const providerAmount = totalAmount - platformAmount;
    const now            = new Date();

    await db
      .update(servicePaymentsTable)
      .set({
        status: "released",
        releasedAt: now,
        providerId: providerId ?? payment.providerId,
        providerAmount,
        platformAmount,
      })
      .where(eq(servicePaymentsTable.serviceId, serviceId));

    logger.info(
      { serviceId, providerId, totalAmount, providerAmount, platformAmount },
      "[payment] Pagamento liberado — 90% prestador / 10% plataforma"
    );

    return res.json({
      ok: true,
      totalAmount,
      providerAmount,
      platformAmount,
      platformFeeRate: PLATFORM_FEE_RATE,
    });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[payment/release] Erro");
    return res.status(500).json({
      error: error.message || "Erro ao liberar pagamento.",
    });
  }
});

export default router;
