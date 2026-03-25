import { useState, useEffect } from "react";

const TOKEN_KEY = "solicite_admin_token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });

  const login = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return { token, login, logout, isAuthenticated: !!token };
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function authHeaders() {
  const token = getAuthToken();
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
}
