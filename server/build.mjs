/**
 * server/build.mjs
 * Self-contained build + start script for Render deployment.
 * Uses only npm (no pnpm / workspace protocol needed).
 *
 * When called via `npm run build` → builds the bundle only.
 * When called via `npm start`     → builds the bundle, then starts the server.
 *
 * Build:  npm install && npm run build
 * Start:  npm start              (runs: node server/build.mjs)
 */

import { createRequire } from "node:module";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot  = path.resolve(serverDir, "..");
const distDir   = path.resolve(serverDir, "dist");

// Detect whether we're being run as the start script or the build script.
// npm sets this env var automatically when running package.json scripts.
const lifecycleEvent = process.env.npm_lifecycle_event; // 'start' | 'build' | undefined

async function bundle() {
  await rm(distDir, { recursive: true, force: true });

  // ── 1. Bundle API server ───────────────────────────────────────────────────
  console.log("\n▶ Bundling API server…");
  await esbuild({
    entryPoints: [path.resolve(repoRoot, "artifacts/api-server/src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",

    // Resolve workspace packages by source path — no workspace protocol needed
    alias: {
      "@workspace/db":        path.resolve(repoRoot, "lib/db/src/index.ts"),
      "@workspace/db/schema": path.resolve(repoRoot, "lib/db/src/schema/index.ts"),
      "@workspace/api-zod":   path.resolve(repoRoot, "lib/api-zod/src/index.ts"),
    },

    external: [
      "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas",
      "bcrypt", "argon2", "fsevents", "re2", "farmhash",
      "bufferutil", "utf-8-validate", "pg-native",
      "lightningcss", "sass-embedded",
    ],

    sourcemap: "linked",
    plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],

    // Polyfill __dirname / __filename / require for ESM bundle
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname  = __bannerPath.dirname(globalThis.__filename);
`,
    },
  });

  // ── 2. Copy pre-built admin panel ─────────────────────────────────────────
  const adminSrc  = path.resolve(repoRoot, "artifacts/admin/dist/public");
  const adminDest = path.resolve(distDir, "admin-public");
  console.log("\n▶ Copying admin panel…");
  try {
    await cp(adminSrc, adminDest, { recursive: true });
    console.log("  ✓ Admin copied → dist/admin-public/");
  } catch {
    console.warn("  ⚠ Admin dist not found — skipping (run admin build first)");
  }
}

async function main() {
  await bundle();

  if (lifecycleEvent === "start") {
    // ── 3. Start the server (only when invoked via `npm start`) ───────────────
    console.log("\n▶ Starting server…");
    await import("./dist/index.mjs");
  } else {
    console.log("\n✅ Build complete — run: npm start");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
