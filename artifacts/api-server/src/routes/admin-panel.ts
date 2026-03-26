import { db, servicePaymentsTable, payoutsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { Router, type Request, type Response, type NextFunction } from "express";

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
        totalPago:        sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        totalPendente:    sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        qtdTransacoes:    sql<number>`COUNT(*)::int`,
      })
      .from(payoutsTable);

    return res.json({
      saldo: {
        totalArrecadado: row?.totalArrecadado ?? 0,
        totalPago:        row?.totalPago        ?? 0,
        totalPendente:    row?.totalPendente    ?? 0,
        qtdTransacoes:    row?.qtdTransacoes    ?? 0,
        moeda: "BRL (centavos)",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.use(requireToken);

// GET /admin — página HTML
router.get("/", (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Painel Admin — SOLICITE</title>
  <style>
    body { font-family: sans-serif; background: #0A0A0F; color: #e0e0e0; padding: 2rem; }
    h1   { color: #00D4FF; }
    .status { display: inline-block; background: #1a1a2e; border: 1px solid #00D4FF;
              color: #00D4FF; padding: 0.4rem 1rem; border-radius: 6px; margin: 1rem 0; }
    a    { display: block; margin: 0.75rem 0; color: #00D4FF; font-size: 1.1rem; }
    a:hover { color: #ffffff; }
    p    { color: #888; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Painel Admin</h1>
  <div class="status">API online</div>
  <br/>
  <a href="/admin/pagamentos">→ /admin/pagamentos — Lista de pagamentos</a>
  <a href="/admin/saldo">→ /admin/saldo — Saldo da plataforma</a>
  <p>Autenticação: header <code>x-admin: 123456</code> obrigatório em todas as rotas.</p>
</body>
</html>`);
});

// GET /admin/pagamentos — lista todos os pagamentos
router.get("/pagamentos", async (_req: Request, res: Response) => {
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

// GET /admin/saldo — saldo total acumulado da plataforma
router.get("/saldo", async (_req: Request, res: Response) => {
  try {
    const [row] = await db
      .select({
        totalArrecadado: sql<number>`COALESCE(SUM(${payoutsTable.platformFee}), 0)::int`,
        totalPago:        sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        totalPendente:    sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.platformFee} ELSE 0 END), 0)::int`,
        qtdTransacoes:    sql<number>`COUNT(*)::int`,
      })
      .from(payoutsTable);

    return res.json({
      saldo: {
        totalArrecadado:  row?.totalArrecadado  ?? 0,
        totalPago:         row?.totalPago         ?? 0,
        totalPendente:     row?.totalPendente     ?? 0,
        qtdTransacoes:     row?.qtdTransacoes     ?? 0,
        moeda: "BRL (centavos)",
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
