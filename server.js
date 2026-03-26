// Entry point — starts the compiled server bundle
// Build step: cd artifacts/api-server && npm install && node build.mjs
import("./artifacts/api-server/dist/index.mjs").catch((err) => {
  console.error("[server.js] Failed to start:", err.message);
  process.exit(1);
});
