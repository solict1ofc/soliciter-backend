/**
 * render-build.mjs
 * Orchestrates the full production build for Render deployment:
 *  1. Build the API server (TypeScript → ESM)
 *  2. Build the admin panel (Vite SPA at /admin/)
 *  3. Build the mobile Expo bundles (static Expo Go server)
 */
import { execSync } from "child_process";

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

const env = { ...process.env };

// 1. Build API server
run("pnpm --filter @workspace/api-server run build", { env });

// 2. Build admin panel — force base to /admin/ and provide a dummy PORT for Vite config
run("pnpm --filter @workspace/admin run build", {
  env: { ...env, BASE_PATH: "/admin/", PORT: env.PORT || "10000" },
});

// 3. Build mobile Expo bundles
// EXPO_PUBLIC_DOMAIN is set by render.yaml from $RENDER_EXTERNAL_HOSTNAME
// EXPO_PUBLIC_API_URL can override the API base entirely
if (!env.EXPO_PUBLIC_DOMAIN && !env.EXPO_PUBLIC_API_URL && !env.RENDER_EXTERNAL_HOSTNAME) {
  console.warn(
    "⚠ EXPO_PUBLIC_DOMAIN / RENDER_EXTERNAL_HOSTNAME not set — mobile build may embed wrong API URL.\n" +
    "  Set EXPO_PUBLIC_DOMAIN=your-app.onrender.com in your Render environment."
  );
}

// Build the static Expo Go bundles
run("pnpm --filter @workspace/mobile run build", {
  env: {
    ...env,
    EXPO_PUBLIC_DOMAIN: env.EXPO_PUBLIC_DOMAIN || env.RENDER_EXTERNAL_HOSTNAME || "localhost",
  },
});

console.log("\n✅ Render build complete");
