import app from "./app";
import { initDb } from "@workspace/db";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"] ?? 10000);
const safePort = Number.isNaN(port) || port <= 0 ? 10000 : port;

async function start() {
  // ── 1. Run DB migrations (CREATE TABLE IF NOT EXISTS for all tables) ─────────
  // Retries up to 5 times with exponential back-off so Render's DB cold-start
  // (which can take a few seconds after the web service boot) is handled safely.
  if (process.env.DATABASE_URL) {
    const MAX = 5;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        await initDb();
        logger.info("[startup] DB migration OK");
        break;
      } catch (err: any) {
        if (attempt === MAX) {
          logger.error({ err }, "[startup] DB migration failed after all retries — continuing anyway");
        } else {
          const wait = attempt * 2000;
          logger.warn(`[startup] DB migration attempt ${attempt}/${MAX} failed: ${err.message} — retrying in ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
  } else {
    logger.error(
      "[startup] DATABASE_URL não configurada! " +
      "Configure no Render → Environment → DATABASE_URL. " +
      "Rotas de login/cadastro vão falhar até isso ser corrigido."
    );
  }

  // ── 2. Start HTTP server ─────────────────────────────────────────────────────
  app.listen(safePort, "0.0.0.0", () => {
    logger.info({ port: safePort }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
