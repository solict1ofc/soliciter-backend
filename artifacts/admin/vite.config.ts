import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(async ({ command }) => {
  const isDev = command === "serve";

  // PORT is only needed for the dev server / preview — not for production builds
  const rawPort = process.env.PORT;
  const port = rawPort ? Number(rawPort) : 3000;

  // BASE_PATH: defaults to /admin/ so builds work on Render without env var
  const basePath = process.env.BASE_PATH || "/admin/";

  const plugins = [react(), tailwindcss()];

  // Replit-specific plugins — only in non-production dev sessions
  if (isDev && process.env.REPL_ID !== undefined) {
    const { default: runtimeErrorOverlay } = await import(
      "@replit/vite-plugin-runtime-error-modal"
    );
    plugins.push(runtimeErrorOverlay());

    if (process.env.NODE_ENV !== "production") {
      const [{ cartographer }, { devBanner }] = await Promise.all([
        import("@replit/vite-plugin-cartographer").then((m) => ({
          cartographer: m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
        })),
        import("@replit/vite-plugin-dev-banner").then((m) => ({
          devBanner: m.devBanner(),
        })),
      ]);
      plugins.push(cartographer, devBanner);
    }
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets"
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
      proxy: {
        "/api": {
          target: "https://solicite-backend.onrender.com",
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
