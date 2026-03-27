import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Log clearly but don't crash — the server will still bind to PORT
  // so Render's health check passes; DB operations will fail gracefully
  console.error(
    "[db] FATAL: DATABASE_URL is not set. " +
    "Configure it in Render → Environment before deploying."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://missing:missing@localhost/missing",
  // Short connect timeout so a bad URL fails fast rather than hanging
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./init";
