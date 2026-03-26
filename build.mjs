/**
 * build.mjs  (root level — Render deployment build script)
 *
 * Build:  node build.mjs            (called by npm run build)
 * Start:  node server.js            (called by npm start — imports ./dist/index.mjs)
 *
 * What it does:
 *   1. Bundles artifacts/api-server/src/index.ts → dist/index.mjs via esbuild.
 *      Workspace libs (@workspace/db, @workspace/api-zod) are inlined by path
 *      alias — no pnpm / workspace:* protocol required.
 *   2. Copies the pre-built admin panel → dist/admin-public/
 */

import { createRequire } from "node:module";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const root    = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(root, "dist");

async function main() {
  await rm(distDir, { recursive: true, force: true });

  // ── 1. Bundle API server ────────────────────────────────────────────────────
  console.log("\n▶ Bundling API server…");
  await esbuild({
    entryPoints: [path.resolve(root, "artifacts/api-server/src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",

    // Resolve workspace packages by source path — no workspace protocol needed
    alias: {
      "@workspace/db":        path.resolve(root, "lib/db/src/index.ts"),
      "@workspace/db/schema": path.resolve(root, "lib/db/src/schema/index.ts"),
      "@workspace/api-zod":   path.resolve(root, "lib/api-zod/src/index.ts"),
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

  // ── 2. Copy pre-built admin panel ──────────────────────────────────────────
  const adminSrc  = path.resolve(root, "artifacts/admin/dist/public");
  const adminDest = path.resolve(distDir, "admin-public");
  console.log("\n▶ Copying admin panel…");
  try {
    await cp(adminSrc, adminDest, { recursive: true });
    console.log("  ✓ Admin copied → dist/admin-public/");
  } catch {
    console.warn("  ⚠ Admin dist not found — skipping");
  }

  console.log("\n✅ Build complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
