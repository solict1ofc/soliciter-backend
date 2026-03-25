import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { logger } from "../lib/logger";
import https from "node:https";

const router = Router();

const PLATFORM_FEE_RATE = 0.10;

/**
 * Retorna o cliente do Mercado Pago somente quando o token tem formato válido.
 * Tokens válidos começam com "TEST-" (sandbox) ou "APP_USR-" (produção).
 */
function getMpClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  const isValidFormat =
    accessToken.startsWith("TEST-") || accessToken.startsWith("APP_USR-");
  if (!isValidFormat) {
    logger.warn("[payment] Token inválido — sem cliente MP");
    return null;
  }

  return new MercadoPagoConfig({ accessToken });
}

/** Fetch a QR-code image as base64 PNG using the free QR Server API */
async function fetchQrBase64(data: string): Promise<string> {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&data=${encodeURIComponent(data)}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end",  () => resolve(Buffer.concat(chunks).toString("base64")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Build a minimal EMV Pix string for test/fallback mode */
function buildTestPixCode(serviceId: string, amountInReais: number): string {
  const amt  = amountInReais.toFixed(2);
  const key  = "solicite@plataforma.pix";
  const name = "SOLICITE PLATAFORMA";
  const city = "Goiania";
  const txid = serviceId.replace(/[^A-Za-z0-9]/g, "").slice(0, 25).padEnd(5, "0");
  const payload =
    `000201` +
    `010212` +
    `2641` +
    `0014br.gov.bcb.pix` +
    `01${String(key.length).padStart(2, "0")}${key}` +
    `5204000053039865406${amt.length}${amt}` +
    `5802BR` +
    `59${String(name.length).padStart(2, "0")}${name}` +
    `60${String(city.length).padStart(2, "0")}${city}` +
    `62${String(txid.length + 4).padStart(2, "0")}05${String(txid.length).padStart(2, "0")}${txid}` +
    `6304`;
  return payload + "0000";
}

// ── POST /api/payment/create-payment ──────────────────────────────────────────
// Cria um pagamento PIX destinado à conta da plataforma (marketplace).
// O valor ficará RETIDO até o serviço ser finalizado e liberado.
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
        error: "Dados inválidos. Valor mínimo para pagamento é R$ 1,00",
      });
    }

    const amountInReais = amountInCents / 100;
    const client = getMpClient();

    // ── MODO TESTE: sem token do MP ─────────────────────────────────────────
    if (!client) {
      logger.warn({ serviceId }, "[payment] Sem token MP — modo teste");

      const pixCode      = buildTestPixCode(serviceId, amountInReais);
      const testPaymentId = `TEST_${serviceId}_${Date.now()}`;

      let qrCode = "";
      try {
        qrCode = await fetchQrBase64(pixCode);
      } catch {
        logger.warn("[payment] Falha ao gerar QR externo");
      }

      await db
        .insert(servicePaymentsTable)
        .values({
          serviceId,
          paymentId: testPaymentId,
          amount: amountInCents,
          status: "test_pending",
          pixCode,
        })
        .onConflictDoUpdate({
          target: servicePaymentsTable.serviceId,
          set: {
            paymentId: testPaymentId,
            amount: amountInCents,
            status: "test_pending",
            pixCode,
          },
        });

      logger.info({ serviceId, testPaymentId }, "[payment] Pagamento teste criado");
      return res.json({
        paymentId: testPaymentId,
        qrCode,
        pixCode,
        isTestMode: true,
      });
    }

    // ── MODO PRODUÇÃO: PIX vai para a conta da plataforma ──────────────────
    const payment = new Payment(client);

    const result = await payment.create({
      body: {
        transaction_amount: amountInReais,
        payment_method_id: "pix",
        payer: {
          email: userEmail || "cliente@solicite.app",
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

    if (!paymentId || !qrCode || !pixCode) {
      logger.error({ result }, "Resposta inesperada do Mercado Pago");
      throw new Error("Resposta inválida do Mercado Pago — tente novamente");
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

    logger.info({ serviceId, paymentId, amountInReais }, "[payment] PIX criado → conta plataforma");
    res.json({ paymentId, qrCode, pixCode, isTestMode: false });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/create-payment]");
    res.status(500).json({ error: error.message || "Erro ao criar pagamento Pix" });
  }
});

// ── GET /api/payment/status/:serviceId ────────────────────────────────────────
// Retorna o status do pagamento.
// Quando confirmado, muda para "retained" (retido pela plataforma).
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

    // Já está retido ou liberado — retornar status atual
    if (payment.status === "retained" || payment.status === "released") {
      return res.json({ status: payment.status });
    }

    // Modo teste: confirmar e reter imediatamente na primeira consulta
    if (payment.status === "test_pending") {
      const now = new Date();
      await db
        .update(servicePaymentsTable)
        .set({ status: "retained", paidAt: now, retainedAt: now })
        .where(eq(servicePaymentsTable.serviceId, serviceId));
      logger.info({ serviceId }, "[payment] Pagamento teste retido");
      return res.json({ status: "retained", isTestMode: true });
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

    // Pendente: verificar com o Mercado Pago
    if (payment.status === "pending" && payment.paymentId) {
      const client = getMpClient();
      if (client) {
        try {
          const mpPayment  = new Payment(client);
          const paymentInfo = await mpPayment.get({ id: parseInt(payment.paymentId) });

          if (paymentInfo.status === "approved") {
            const now = new Date();
            await db
              .update(servicePaymentsTable)
              .set({ status: "retained", paidAt: now, retainedAt: now })
              .where(eq(servicePaymentsTable.serviceId, serviceId));
            logger.info(
              { serviceId, paymentId: payment.paymentId },
              "[payment] Pagamento confirmado → retido pela plataforma"
            );
            return res.json({ status: "retained" });
          }
        } catch (mpErr: any) {
          logger.warn({ err: mpErr }, "[payment] Erro ao verificar MP");
        }
      }
    }

    res.json({ status: payment.status });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/status]");
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/payment/release/:serviceId ──────────────────────────────────────
// Libera o pagamento retido após a conclusão do serviço.
// Aplica a taxa da plataforma (10%) e credita 90% ao prestador.
// Só pode ser chamado quando o pagamento está em status "retained".
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
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    if (payment.status === "released") {
      return res.json({
        ok: true,
        alreadyReleased: true,
        providerAmount: payment.providerAmount,
        platformAmount: payment.platformAmount,
      });
    }

    const allowedStatuses = ["retained", "paid", "test_pending"];
    if (!allowedStatuses.includes(payment.status)) {
      return res.status(400).json({
        error: `Pagamento com status "${payment.status}" não pode ser liberado`,
      });
    }

    // Calcular split: 90% prestador / 10% plataforma
    const totalAmount    = payment.amount; // em centavos
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

    res.json({
      ok: true,
      totalAmount,
      providerAmount,
      platformAmount,
      platformFeeRate: PLATFORM_FEE_RATE,
    });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/release]");
    res.status(500).json({ error: error.message || "Erro ao liberar pagamento" });
  }
});

export default router;
