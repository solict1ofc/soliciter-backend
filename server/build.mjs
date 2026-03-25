/**
 * server/build.mjs
 * Self-contained build script for Render deployment.
 * Uses only npm (no pnpm / workspace protocol needed).
 *
 * What it does:
 *   1. Bundles the API server TypeScript into dist/index.mjs using esbuild.
 *      Workspace libs (@workspace/db, @workspace/api-zod) are resolved by
 *      path alias and fully inlined — no workspace:* resolution required.
 *   2. Copies the pre-built admin panel into dist/admin-public/.
 *
 * Build:  npm install && npm run build   (or: node build.mjs)
 * Start:  npm start
 */

import { createRequire } from "node:module";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const serverDir  = path.dirname(fileURLToPath(import.meta.url));
const repoRoot   = path.resolve(serverDir, "..");
const distDir    = path.resolve(serverDir, "dist");

async function main() {
  // Clean dist
  await rm(distDir, { recursive: true, force: true });

  // ── 1. Bundle API server ─────────────────────────────────────────────────
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
      "@workspace/db":         path.resolve(repoRoot, "lib/db/src/index.ts"),
      "@workspace/db/schema":  path.resolve(repoRoot, "lib/db/src/schema/index.ts"),
      "@workspace/api-zod":    path.resolve(repoRoot, "lib/api-zod/src/index.ts"),
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

  // ── 2. Copy pre-built admin panel ────────────────────────────────────────
  const adminSrc  = path.resolve(repoRoot, "artifacts/admin/dist/public");
  const adminDest = path.resolve(distDir, "admin-public");
  console.log("\n▶ Copying admin panel…");
  try {
    await cp(adminSrc, adminDest, { recursive: true });
    console.log(`  ✓ Admin copied → dist/admin-public/`);
  } catch {
    console.warn("  ⚠ Admin dist not found — skipping (run admin build first)");
  }

  console.log("\n✅ Build complete — run: npm start");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
