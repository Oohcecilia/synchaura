import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import { apiRequest } from "@/api/client";
import { resetLocalDB } from "@/db/couch";

const AuthContext = createContext();

// -------------------------

const STORAGE_KEY = "session";

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // =========================
  // SAVE SESSION
  // =========================
  const saveSession = useCallback((data) => {
    if (!data) return;

    const safeSession = {
      userId: data.userId,
      token: data.token,
      workspaceId: data.workspaceId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSession));
    setSession(safeSession);
  }, []);

  // =========================
  // LOGOUT
  // =========================
  const logout = useCallback(async () => {
    setSession(null);
    setUser(null);
    setActiveWorkspace(null);
    setIsAuthenticated(false);

    localStorage.removeItem(STORAGE_KEY);

    try {
      await resetLocalDB();
    } catch (e) {
      console.warn("DB reset failed", e);
    }
  }, []);

  // =========================
  // VERIFY SESSION (backend truth check)
  // =========================
  const verifySession = useCallback(async (sessionData) => {
    try {

      const res = await apiRequest("/auth/verify-session", {
        method: "POST",
        body: {
          userId: sessionData.userId,
          token: sessionData.token,
        },
      });

      if (!res?.success || !res?.user) {
        return false;
      }

      setUser(res.user);
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  // =========================
  // INIT SESSION (boot + offline-first)
  // =========================
useEffect(() => {
  const init = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      const parsed = JSON.parse(stored);

      if (!parsed?.token || !parsed?.userId) {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setSession(parsed);

      // 📴 OFFLINE
      if (!navigator.onLine) {
        setIsAuthenticated(true);
        setUser(parsed.user || null);
        return;
      }

      // 🌐 ONLINE VERIFY
      const valid = await verifySession(parsed);

      if (!valid) {
        setSession(null);
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setIsAuthenticated(true);

    } catch (err) {
      console.error("Auth init error:", err);
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoadingAuth(false); // ✅ single source of truth
    }
  };

  init();
}, [verifySession]);

  // =========================
  // AUTO REVALIDATION (when internet comes back)
  // =========================
  useEffect(() => {
    const handleOnline = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);

      const valid = await verifySession(parsed);

      if (!valid) {
        await logout();
      } else {
        setIsAuthenticated(true);
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [verifySession, logout]);

  // =========================
  // LOGIN
  // =========================
  const login = useCallback(async ({ phone, pin }) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const data = await apiRequest("/login", {
        method: "POST",
        body: { username: phone, password: pin },
      });

      if (!data?.success) {
        throw new Error(data?.error || "Invalid credentials");
      }

      const sessionData = {
        userId: data.user_session.id,
        token: data.token,
        workspaceId: data.db,
      };

      saveSession(sessionData);
      setUser(data.user_session);
      setIsAuthenticated(true);

      return sessionData;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [saveSession]);

  // =========================
  // REGISTER
  // =========================
  const register = useCallback(async (formData) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const data = await apiRequest("/register", {
        method: "POST",
        body: formData,
      });

      if (!data?.success) {
        throw new Error(data?.error || "Registration failed");
      }

      const sessionData = {
        userId: data.user_id,
        token: data.token,
        workspaceId: data.db,
      };

      saveSession(sessionData);
      setUser(data.user);
      setIsAuthenticated(true);

      return data;
    } catch (err) {
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [saveSession]);

  // =========================
  // CONTEXT VALUE
  // =========================
  const value = useMemo(() => ({
    session,
    user,
    activeWorkspace,

    isAuthenticated,
    isLoadingAuth,
    authError,

    login,
    register,
    logout,
    setUser,
    setAuthError,
  }), [
    session,
    user,
    activeWorkspace,
    isAuthenticated,
    isLoadingAuth,
    authError,
    login,
    register,
    logout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// -------------------------
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};