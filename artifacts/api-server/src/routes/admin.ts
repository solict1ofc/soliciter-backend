/**
 * Admin — Gestão de Payouts
 * ─────────────────────────────────────────────────────────────────────────────
 * Segurança: Bearer token via ADMIN_SECRET env var.
 *
 * GET  /admin/payouts           → lista todos os payouts (filtro: ?status=pending|paid)
 * GET  /admin/payouts/summary   → total acumulado por prestador
 * PUT  /admin/payouts/:id/paid  → marca payout como pago
 */

import { db, payoutsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

const router = Router();

// ── Middleware de autenticação admin ──────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(503).json({ error: "ADMIN_SECRET não configurado no servidor." });
  }
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== adminSecret) {
    return res.status(401).json({ error: "Acesso negado. Token admin inválido." });
  }
  next();
}

router.use("/admin", requireAdmin);

// ── GET /admin/payouts ────────────────────────────────────────────────────────
router.get("/admin/payouts", async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;

    const rows = await db
      .select({
        id:             payoutsTable.id,
        serviceId:      payoutsTable.serviceId,
        providerId:     payoutsTable.providerId,
        paymentId:      payoutsTable.paymentId,
        totalAmount:    payoutsTable.totalAmount,
        platformFee:    payoutsTable.platformFee,
        providerAmount: payoutsTable.providerAmount,
        status:         payoutsTable.status,
        paidAt:         payoutsTable.paidAt,
        createdAt:      payoutsTable.createdAt,
        providerName:   usersTable.name,
        providerEmail:  usersTable.email,
      })
      .from(payoutsTable)
      .leftJoin(usersTable, eq(payoutsTable.providerId, sql`${usersTable.id}::text`))
      .orderBy(payoutsTable.createdAt);

    const filtered = statusFilter
      ? rows.filter((r) => r.status === statusFilter)
      : rows;

    return res.json({ payouts: filtered });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[admin/payouts] Erro ao listar");
    return res.status(500).json({ error: error.message });
  }
});

// ── GET /admin/payouts/summary ────────────────────────────────────────────────
// Retorna total acumulado pendente por prestador
router.get("/admin/payouts/summary", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        providerId:          payoutsTable.providerId,
        providerName:        usersTable.name,
        providerEmail:       usersTable.email,
        totalPending:        sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.providerAmount} ELSE 0 END), 0)::int`,
        totalPaid:           sql<number>`COALESCE(SUM(CASE WHEN ${payoutsTable.status} = 'paid' THEN ${payoutsTable.providerAmount} ELSE 0 END), 0)::int`,
        countPending:        sql<number>`COUNT(CASE WHEN ${payoutsTable.status} = 'pending' THEN 1 END)::int`,
        countPaid:           sql<number>`COUNT(CASE WHEN ${payoutsTable.status} = 'paid' THEN 1 END)::int`,
      })
      .from(payoutsTable)
      .leftJoin(usersTable, eq(payoutsTable.providerId, sql`${usersTable.id}::text`))
      .groupBy(payoutsTable.providerId, usersTable.name, usersTable.email)
      .orderBy(sql`SUM(CASE WHEN ${payoutsTable.status} = 'pending' THEN ${payoutsTable.providerAmount} ELSE 0 END) DESC`);

    return res.json({ summary: rows });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[admin/payouts/summary] Erro");
    return res.status(500).json({ error: error.message });
  }
});

// ── PUT /admin/payouts/:id/paid ───────────────────────────────────────────────
router.put("/admin/payouts/:id/paid", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID inválido." });

    const [existing] = await db
      .select().from(payoutsTable).where(eq(payoutsTable.id, id)).limit(1);

    if (!existing) return res.status(404).json({ error: "Payout não encontrado." });
    if (existing.status === "paid") {
      return res.json({ ok: true, alreadyPaid: true });
    }

    await db
      .update(payoutsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payoutsTable.id, id));

    logger.info({ id, serviceId: existing.serviceId, providerId: existing.providerId }, "[admin] Payout marcado como pago");

    return res.json({ ok: true });
  } catch (error: any) {
    logger.error({ err: error?.message }, "[admin/payouts/paid] Erro");
    return res.status(500).json({ error: error.message });
  }
});

export default router;
