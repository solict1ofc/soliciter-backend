import { Router, Request, Response } from "express";
import { db } from "../../../lib/db/src";
import { payoutsTable } from "../../../lib/db/src/schema";
import { eq } from "drizzle-orm";

const router = Router();

// 🔹 SOLICITAR SAQUE
router.post("/solicitar-saque", async (req: Request, res: Response) => {
  try {
    const { userId, valor, pix, nome, cpf } = req.body;

    if (!userId || !valor || !pix) {
      return res.status(400).json({ error: "Dados obrigatórios faltando" });
    }

    const [novoSaque] = await db
      .insert(payoutsTable)
      .values({
        userId,
        amountToPay: valor,
        pixKey: pix,
        receiverName: nome || null,
        receiverCpf: cpf || null,
        status: "pending",
        createdAt: new Date(),
      })
      .returning();

    return res.json({
      mensagem: "Saque solicitado",
      saque: novoSaque,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 LISTAR SAQUES (ADM)
router.get("/saques", async (_req: Request, res: Response) => {
  try {
    const saques = await db.select().from(payoutsTable);
    return res.json(saques);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 APROVAR SAQUE
router.post("/aprovar-saque/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [saque] = await db
      .update(payoutsTable)
      .set({ status: "approved" })
      .where(eq(payoutsTable.id, id))
      .returning();

    if (!saque) {
      return res.status(404).json({ error: "Saque não encontrado" });
    }

    return res.json({
      mensagem: "Saque aprovado",
      saque,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 RECUSAR SAQUE
router.post("/recusar-saque/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const [saque] = await db
      .update(payoutsTable)
      .set({ status: "rejected" })
      .where(eq(payoutsTable.id, id))
      .returning();

    if (!saque) {
      return res.status(404).json({ error: "Saque não encontrado" });
    }

    return res.json({
      mensagem: "Saque recusado",
      saque,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
