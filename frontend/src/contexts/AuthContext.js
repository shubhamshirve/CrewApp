import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

const api = axios.create({ baseURL: API });

function getToken() {
  // sessionStorage token (used for impersonation) takes priority over localStorage
  return sessionStorage.getItem("crewbook_token") || localStorage.getItem("crewbook_token") || null;
}

// On page load, check for impersonation token in URL (passed by admin for cross-tab impersonation)
function bootstrapImpersonationToken() {
  const params = new URLSearchParams(window.location.search);
  const tok = params.get("impersonate_token");
  if (tok) {
    sessionStorage.setItem("crewbook_token", tok);
    // Remove token from URL without page reload
    params.delete("impersonate_token");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
  }
}
bootstrapImpersonationToken();

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useApi = () => api;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("crewbook_token");
      sessionStorage.removeItem("crewbook_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("crewbook_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("crewbook_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("crewbook_token");
    sessionStorage.removeItem("crewbook_token");
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refreshUser, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
