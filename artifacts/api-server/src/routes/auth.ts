import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router } from "express";
import {
  comparePassword,
  extractBearerToken,
  hashPassword,
  sanitizeCPF,
  signToken,
  validateCPF,
  validateEmail,
  verifyToken,
} from "../lib/auth";

const router = Router();

// ── POST /api/auth/register ────────────────────────────────────────────────────
router.post("/auth/register", async (req, res) => {
  try {
    const { name, cpf, email, password } = req.body as Record<string, string>;

    if (!name?.trim() || !cpf || !email || !password) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({ error: "Nome deve ter ao menos 3 caracteres." });
    }

    const cleanCPF = sanitizeCPF(cpf);
    if (!validateCPF(cleanCPF)) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    const normalEmail = email.trim().toLowerCase();
    if (!validateEmail(normalEmail)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres." });
    }

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalEmail))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "E-mail já cadastrado." });
    }

    const [byCpf] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.cpf, cleanCPF))
      .limit(1);

    if (byCpf) {
      return res.status(409).json({ error: "CPF já cadastrado." });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(usersTable)
      .values({ name: name.trim(), cpf: cleanCPF, email: normalEmail, passwordHash })
      .returning({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        cpf: usersTable.cpf,
        isPremium: usersTable.isPremium,
      });

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf, isPremium: user.isPremium },
    });
  } catch (error: any) {
    console.error("[auth/register]", error.message);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const normalEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalEmail))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, cpf: user.cpf, isPremium: user.isPremium },
    });
  } catch (error: any) {
    console.error("[auth/login]", error.message);
    res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: "Token não fornecido." });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Token inválido ou expirado." });

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        cpf: usersTable.cpf,
        isPremium: usersTable.isPremium,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    res.json({ user });
  } catch (error: any) {
    console.error("[auth/me]", error.message);
    res.status(500).json({ error: "Erro interno." });
  }
});

export default router;
