import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import React, { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const TOKEN_KEY = "solicite_auth_token_v1";
const FETCH_TIMEOUT_MS = 30_000; // 30 s — accounts for Render cold-start

console.log("[AuthContext] API_BASE =", API_BASE);

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  cpf: string;
  isPremium: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** fetch() with AbortController timeout */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(
        "Tempo limite excedido. O servidor demorou para responder — tente novamente em alguns segundos."
      );
    }
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  } finally {
    clearTimeout(id);
  }
}

/** Parse response JSON safely; throws descriptive error on failure */
async function parseJSON(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    console.error("[AuthContext] Resposta não é JSON. Status:", res.status, "URL:", res.url);
    throw new Error(`Erro no servidor (${res.status}). Tente novamente em instantes.`);
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

function useAuthContextValue() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Boot: restore session from storage ──────────────────────────────────
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (!stored) return;

      const res = await fetchWithTimeout(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      });

      if (res.ok) {
        const data = await parseJSON(res);
        setToken(stored);
        setUser(data.user);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (err: any) {
      console.warn("[AuthContext] restoreSession error:", err.message);
      // network error → keep user logged out silently
    } finally {
      setLoading(false);
    }
  };

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(
    async (name: string, cpf: string, email: string, password: string) => {
      const url = `${API_BASE}/auth/register`;
      console.log("[register] POST →", url, { name, email, cpf: cpf.slice(0, 3) + "***" });

      let res: Response;
      try {
        res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, cpf, email, password }),
        });
      } catch (err: any) {
        console.error("[register] Erro de rede:", err.message);
        throw err;
      }

      console.log("[register] Status:", res.status);
      const data = await parseJSON(res);
      console.log("[register] Resposta:", JSON.stringify(data));

      if (!res.ok) {
        const msg = data?.error ?? "Erro ao cadastrar. Tente novamente.";
        console.error("[register] Erro do servidor:", msg);
        throw new Error(msg);
      }

      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
    },
    []
  );

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const url = `${API_BASE}/auth/login`;
    console.log("[login] POST →", url, { email });

    let res: Response;
    try {
      res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch (err: any) {
      console.error("[login] Erro de rede:", err.message);
      throw err;
    }

    console.log("[login] Status:", res.status);
    const data = await parseJSON(res);

    if (!res.ok) {
      const msg = data?.error ?? "Erro ao entrar. Tente novamente.";
      console.error("[login] Erro do servidor:", msg);
      throw new Error(msg);
    }

    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  // ── Refresh user ─────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (!stored) return;
      const res = await fetchWithTimeout(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      });
      if (res.ok) {
        const data = await parseJSON(res);
        setUser(data.user);
      }
    } catch (err: any) {
      console.warn("[refreshUser] Erro:", err.message);
      // silent — network issues shouldn't break the session
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return { user, token, loading, login, register, logout, refreshUser };
}

export const [AuthContextProvider, useAuth] = createContextHook(useAuthContextValue);
