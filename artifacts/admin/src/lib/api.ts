/**
 * Base URL for all admin API requests.
 *
 * In production the SPA is served by the same Express server that exposes /api,
 * so a relative path would work — but we use the absolute Render URL everywhere
 * so that dev-mode (Replit iframe) also reaches the real backend without relying
 * on the Vite dev proxy (which adds an extra hop and can cause issues in the
 * Replit iframe proxy chain).
 *
 * CORS is configured on the backend to allow all origins, so cross-origin
 * fetches from Replit are fine.
 */
export const API_BASE = "https://solicite-backend.onrender.com";
