import { db, servicePaymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { logger } from "../lib/logger";

const router = Router();

function getMpClient() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado");
  return new MercadoPagoConfig({ accessToken });
}

// ── POST /api/payment/create-payment ──────────────────────────────────────────
// Creates a Pix payment via Mercado Pago and returns QR code + copy-paste code
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
    res.json({ paymentId, qrCode, pixCode });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/create-payment]");
    res.status(500).json({ error: error.message || "Erro ao criar pagamento Pix" });
  }
});

// ── GET /api/payment/status/:serviceId ────────────────────────────────────────
// Returns payment status for a given service, also verifies live with MP
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

    // If still pending, verify live with Mercado Pago
    if (payment.status === "pending" && payment.paymentId) {
      try {
        const client = getMpClient();
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

    res.json({ status: payment.status });
  } catch (error: any) {
    logger.error({ err: error }, "[payment/status]");
    res.status(500).json({ error: error.message });
  }
});

export default router;
