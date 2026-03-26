/**
 * Saque — Solicitação de retirada de saldo
 * POST /sacar
 *
 * Body: {
 *   userId: string
 *   amount: number          (em reais, ex: 50.00)
 *   method: "pix" | "bank"
 *   pixKey?: string
 *   bankHolder?: string
 *   bankCpf?: string
 *   bankName?: string
 *   bankAgency?: string
 *   bankAccount?: string
 *   bankType?: string
 * }
 */

import { db, withdrawalsTable } from "@workspace/db";
import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

router.post("/sacar", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      amount,
      method = "pix",
      pixKey,
      bankHolder,
      bankCpf,
      bankName,
      bankAgency,
      bankAccount,
      bankType,
    } = req.body ?? {};

    // ── Validações ─────────────────────────────────────────────────────────
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId é obrigatório." });
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum < 10) {
      return res.status(400).json({ error: "Valor mínimo para saque é R$ 10,00." });
    }
    if (amountNum > 50000) {
      return res.status(400).json({ error: "Valor máximo por saque é R$ 50.000,00." });
    }

    if (method === "pix" && !pixKey?.trim()) {
      return res.status(400).json({ error: "Chave PIX é obrigatória para saque via PIX." });
    }
    if (method === "bank") {
      if (!bankHolder?.trim()) return res.status(400).json({ error: "Nome do titular é obrigatório." });
      if (!bankName?.trim())   return res.status(400).json({ error: "Nome do banco é obrigatório." });
      if (!bankAgency?.trim()) return res.status(400).json({ error: "Agência é obrigatória." });
      if (!bankAccount?.trim())return res.status(400).json({ error: "Número da conta é obrigatório." });
    }

    // ── Gravar solicitação de saque no banco ────────────────────────────────
    // Valor convertido para centavos para o banco
    const amountCents = Math.round(amountNum * 100);

    const [record] = await db
      .insert(withdrawalsTable)
      .values({
        userId,
        amount: amountCents,
        method,
        pixKey: method === "pix" ? pixKey?.trim() : null,
        bankHolder: method === "bank" ? bankHolder?.trim() : null,
        bankCpf:    method === "bank" ? bankCpf?.trim() : null,
        bankName:   method === "bank" ? bankName?.trim() : null,
        bankAgency: method === "bank" ? bankAgency?.trim() : null,
        bankAccount:method === "bank" ? bankAccount?.trim() : null,
        bankType:   method === "bank" ? (bankType ?? "corrente") : null,
        status: "pending",
      })
      .returning();

    logger.info(
      { withdrawalId: record.id, userId, amount: amountNum, method },
      "[sacar] Solicitação de saque registrada"
    );

    return res.json({
      ok: true,
      withdrawalId: record.id,
      message: method === "pix"
        ? "Saque solicitado! O valor será creditado em até 1 dia útil na sua chave PIX."
        : "Saque solicitado! O valor será transferido em até 2 dias úteis para sua conta bancária.",
    });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[sacar] Erro ao registrar saque");
    return res.status(500).json({ error: "Erro interno ao processar saque. Tente novamente." });
  }
});

export default router;
