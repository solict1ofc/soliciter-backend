import { db, servicePaymentsTable, payoutsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

const router = Router();

const ADMIN_TOKEN = "123456";

function requireToken(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-admin"] !== ADMIN_TOKEN) {
    return res.status(401).send("Acesso negado");
  }
  next();
}

// 🔹 TESTE — saldo simples
router.get("/teste", async (_req: Request, res: Response) => {
  try {
    const [row] = await db
      .select({
        totalArrecadado: sql<number>`COALESCE(SUM(${payoutsTable.platformFee}), 0)::int`,
        totalPago: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        totalPendente: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        qtdTransacoes: sql<number>`COUNT(*)::int`,
      })
      .from(payoutsTable);

    return res.json({
      saldo: {
        totalArrecadado: row?.totalArrecadado ?? 0,
        totalPago: row?.totalPago ?? 0,
        totalPendente: row?.totalPendente ?? 0,
        qtdTransacoes: row?.qtdTransacoes ?? 0,
        moeda: "BRL (centavos)",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 🔹 LISTA DE PAGAMENTOS
router.get(
  "/pagamentos",
  requireToken,
  async (_req: Request, res: Response) => {
    try {
      const payments = await db
        .select()
        .from(servicePaymentsTable)
        .orderBy(desc(servicePaymentsTable.createdAt));

      return res.json({
        total: payments.length,
        pagamentos: payments,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  },
);

// 🔹 SALDO
router.get("/saldo", requireToken, async (_req: Request, res: Response) => {
  try {
    const [row] = await db
      .select({
        totalArrecadado: sql<number>`COALESCE(SUM(${payoutsTable.platformFee}), 0)::int`,
        totalPago: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        totalPendente: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        qtdTransacoes: sql<number>`COUNT(*)::int`,
      })
      .from(payoutsTable);

    return res.json({
      saldo: {
        totalArrecadado: row?.totalArrecadado ?? 0,
        totalPago: row?.totalPago ?? 0,
        totalPendente: row?.totalPendente ?? 0,
        qtdTransacoes: row?.qtdTransacoes ?? 0,
        moeda: "BRL (centavos)",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 🔥 DASHBOARD COMPLETO (USADO PELO PAINEL)
router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [resumo] = await db
      .select({
        totalTransacoes: sql<number>`COUNT(*)::int`,
        totalPendente: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.amountToPay} ELSE 0 END), 0)::int`,
        totalPago: sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.amountToPay} ELSE 0 END), 0)::int`,
        totalComissao: sql<number>`COALESCE(SUM(${payoutsTable.platformFee}), 0)::int`,
      })
      .from(payoutsTable);

    const lista = await db
      .select()
      .from(payoutsTable)
      .orderBy(desc(payoutsTable.createdAt));

    return res.json({
      resumo: {
        totalTransacoes: resumo?.totalTransacoes ?? 0,
        totalPendente: resumo?.totalPendente ?? 0,
        totalPago: resumo?.totalPago ?? 0,
        totalComissao: resumo?.totalComissao ?? 0,
      },
      lista,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
