import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/support/contact
// Recebe mensagem de suporte do usuário e registra no log do servidor.
router.post("/support/contact", (req, res) => {
  const { name, message, userId } = req.body as {
    name?: string;
    message?: string;
    userId?: string;
  };

  if (!name?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "Nome e mensagem são obrigatórios." });
  }

  logger.info(
    { userId: userId ?? "anon", name: name.trim(), message: message.trim() },
    "[support/contact] Nova mensagem de suporte recebida"
  );

  return res.json({ ok: true });
});

export default router;
