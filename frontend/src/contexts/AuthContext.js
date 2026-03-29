import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

const api = axios.create({ baseURL: API });

function getToken() {
  return localStorage.getItem("crewbook_token") || null;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useApi = () => api;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(
    !!localStorage.getItem("crewbook_admin_token")
  );

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("crewbook_token");
      localStorage.removeItem("crewbook_admin_token");
      setIsImpersonating(false);
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
    localStorage.removeItem("crewbook_admin_token");
    setIsImpersonating(false);
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  };

  // Same-page impersonation: swap tokens in localStorage, update React state
  const startImpersonation = async (impersonateToken) => {
    const adminToken = localStorage.getItem("crewbook_token");
    localStorage.setItem("crewbook_admin_token", adminToken);
    localStorage.setItem("crewbook_token", impersonateToken);
    setIsImpersonating(true);
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;  // return so caller can read the impersonated user's name
  };

  // Restore admin session from saved token
  const exitImpersonation = async () => {
    const adminToken = localStorage.getItem("crewbook_admin_token");
    if (adminToken) {
      localStorage.setItem("crewbook_token", adminToken);
      localStorage.removeItem("crewbook_admin_token");
    }
    setIsImpersonating(false);
    const res = await api.get("/auth/me");
    setUser(res.data);
  };

  return (
    <AuthContext.Provider value={{
      user, setUser, loading, login, register, logout, refreshUser, api,
      isImpersonating, startImpersonation, exitImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
