import Stripe from "stripe";
import { logger } from "./lib/logger";

// ─── Credential resolution ────────────────────────────────────────────────────
// Priority:
//   1. STRIPE_SECRET_KEY env var (works on Render, any non-Replit host)
//   2. Replit connector service (works inside Replit)
//
// For production on Render, set:
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_PUBLISHABLE_KEY=pk_live_...

async function getCredentials(): Promise<{ secretKey: string; publishableKey: string }> {
  // 1. Direct env vars — works on Render, Docker, any host
  if (process.env.STRIPE_SECRET_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    };
  }

  // 2. Replit connector service — works only inside Replit
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Stripe credentials not configured. " +
      "Set STRIPE_SECRET_KEY environment variable (for Render/production) " +
      "or configure the Stripe connector (for Replit)."
    );
  }

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as any;
  const connectionSettings = data.items?.[0];

  if (
    !connectionSettings ||
    !connectionSettings.settings?.publishable ||
    !connectionSettings.settings?.secret
  ) {
    throw new Error(`Stripe ${targetEnvironment} connection not found in Replit connector`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable as string,
    secretKey: connectionSettings.settings.secret as string,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as any,
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}
