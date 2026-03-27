import { pool } from "./index";

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  service_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_payments (
  service_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_code TEXT,
  provider_id TEXT,
  provider_amount INTEGER,
  platform_amount INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  retained_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  service_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  payment_id TEXT,
  total_amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  provider_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'pix',
  pix_key TEXT,
  bank_holder TEXT,
  bank_cpf TEXT,
  bank_name TEXT,
  bank_agency TEXT,
  bank_account TEXT,
  bank_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function initDb(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[db/init] DATABASE_URL não configurada — ignorando migração");
    return;
  }
  try {
    await pool.query(INIT_SQL);
    console.log("[db/init] Tabelas criadas/verificadas com sucesso ✓");
  } catch (err: any) {
    console.error("[db/init] Falha ao inicializar tabelas:", err.message);
  }
}
