import { db, servicesTable } from "@workspace/db";
import { Router } from "express";

const router = Router();

// ── POST /api/iniciar-servico ──────────────────────────────────────────────────
router.post("/iniciar-servico", async (req, res) => {
  try {
    const { serviceId } = req.body as { serviceId?: string };

    if (!serviceId) {
      return res.status(400).json({ error: "serviceId é obrigatório" });
    }

    const now = new Date();

    await db
      .insert(servicesTable)
      .values({
        serviceId,
        status: "em_andamento",
        startedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: servicesTable.serviceId,
        set: {
          status: "em_andamento",
          startedAt: now,
          updatedAt: now,
        },
      });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[iniciar-servico]", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/finalizar-servico ────────────────────────────────────────────────
router.post("/finalizar-servico", async (req, res) => {
  try {
    const { serviceId } = req.body as { serviceId?: string };

    if (!serviceId) {
      return res.status(400).json({ error: "serviceId é obrigatório" });
    }

    const now = new Date();

    await db
      .insert(servicesTable)
      .values({
        serviceId,
        status: "concluido",
        completedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: servicesTable.serviceId,
        set: {
          status: "concluido",
          completedAt: now,
          updatedAt: now,
        },
      });

    res.json({ ok: true });
  } catch (error: any) {
    console.error("[finalizar-servico]", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
