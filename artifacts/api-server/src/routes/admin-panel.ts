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

// GET /admin/teste — sem autenticação, retorna saldo da plataforma
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

// GET /admin/pagamentos — lista todos os pagamentos (requer x-admin)
router.get("/pagamentos", requireToken, async (_req: Request, res: Response) => {
  try {
    const payments = await db
      .select()
      .from(servicePaymentsTable)
      .orderBy(desc(servicePaymentsTable.createdAt));
    return res.json({ total: payments.length, pagamentos: payments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/saldo — saldo total acumulado da plataforma (requer x-admin)
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

export default router;
