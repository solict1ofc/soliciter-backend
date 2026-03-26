import app from "./app";
import { logger } from "./lib/logger";

// Render sets PORT automatically; fallback to 10000 for safety
const port = Number(process.env["PORT"] ?? 10000);

if (Number.isNaN(port) || port <= 0) {
  logger.error({ PORT: process.env["PORT"] }, "Invalid PORT value — using 10000");
}

const safePort = Number.isNaN(port) || port <= 0 ? 10000 : port;

// Explicitly bind to 0.0.0.0 so Render's health checks can reach us
app.listen(safePort, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port: safePort }, "Server listening");
});
