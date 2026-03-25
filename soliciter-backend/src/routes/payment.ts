import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { logger } from "../lib/logger";
import https from "node:https";

const router = Router();

/**
 * Retorna o cliente do Mercado Pago somente quando o token tem formato válido.
 * Tokens válidos começam com "TEST-" (sandbox) ou "APP_USR-" (produção).
 * Tokens em formato inválido são ignorados → o sistema cai em modo teste.
 */
function getMpClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  const isValidFormat = accessToken.startsWith("TEST-") || accessToken.startsWith("APP_USR-");
  if (!isValidFormat) {
    logger.warn(
      "[payment] MERCADO_PAGO_ACCESS_TOKEN com formato inválido. " +
      "Token deve começar com 'TEST-' (sandbox) ou 'APP_USR-' (produção). " +
      "Ativando MODO TESTE automático."
    );
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
      res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Build a minimal EMV Pix string for test mode */
function buildTestPixCode(serviceId: string, amountInReais: number): string {
  const amt = amountInReais.toFixed(2);
  const key = "solicite@teste.pix";
  const name = "SOLICITE TESTE";
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

    // ── TEST MODE: no MP token configured ─────────────────────────────────────
    if (!client) {
      logger.warn({ serviceId }, "[payment] MERCADO_PAGO_ACCESS_TOKEN não configurado — usando MODO TESTE");

      const pixCode = buildTestPixCode(serviceId, amountInReais);
      const testPaymentId = `TEST_${serviceId}_${Date.now()}`;

      let qrCode = "";
      try {
        qrCode = await fetchQrBase64(pixCode);
      } catch (e) {
        logger.warn("[payment] Falha ao gerar QR externo — retornando string vazia");
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
          set: { paymentId: testPaymentId, amount: amountInCents, status: "test_pending", pixCode },
        });

      logger.info({ serviceId, testPaymentId }, "[payment] Pagamento teste criado");

      return res.json({
        paymentId: testPaymentId,
        qrCode,
        pixCode,
        isTestMode: true,
      });
    }

    // ── PRODUCTION MODE ────────────────────────────────────────────────────────
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
    const qrCode = result.point_of_interaction?.transaction_data?.qr_code_base64;
    const pixCode = result.point_of_interaction?.transaction_data?.qr_code;

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
        set: { paymentId, amount: amountInCents, status: "pending", pixCode },
      });

    logger.info({ serviceId, paymentId, amountInReais }, "Pagamento Pix criado");
    res.json({ paymentId, qrCode, pixCode, isTestMode: false });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/create-payment]");
    res.status(500).json({ error: error.message || "Erro ao criar pagamento Pix" });
  }
});

// ── GET /api/payment/status/:serviceId ────────────────────────────────────────
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

    if (payment.status === "paid") {
      return res.json({ status: "paid" });
    }

    // Test mode payments: confirm immediately when status is checked
    if (payment.status === "test_pending") {
      await db
        .update(servicePaymentsTable)
        .set({ status: "paid", paidAt: new Date() })
        .where(eq(servicePaymentsTable.serviceId, serviceId));
      logger.info({ serviceId }, "[payment] Pagamento teste confirmado");
      return res.json({ status: "paid", isTestMode: true });
    }

    // If still pending, verify live with Mercado Pago
    if (payment.status === "pending" && payment.paymentId) {
      const client = getMpClient();
      if (client) {
        try {
          const mpPayment = new Payment(client);
          const paymentInfo = await mpPayment.get({ id: parseInt(payment.paymentId) });

          if (paymentInfo.status === "approved") {
            await db
              .update(servicePaymentsTable)
              .set({ status: "paid", paidAt: new Date() })
              .where(eq(servicePaymentsTable.serviceId, serviceId));
            logger.info({ serviceId, paymentId: payment.paymentId }, "Pagamento confirmado via polling");
            return res.json({ status: "paid" });
          }
        } catch (mpErr: any) {
          logger.warn({ err: mpErr }, "Erro ao verificar pagamento no MP — retornando status do DB");
        }
      }
    }

    res.json({ status: payment.status });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/status]");
    res.status(500).json({ error: error.message });
  }
});

export default router;
