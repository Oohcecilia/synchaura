import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";

import { apiRequest } from "@/api/client";
import { closeLocalDB } from "@/db/couch";

const AuthContext = createContext();
const STORAGE_KEY = "session";

const readStoredSession = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed?.token && parsed?.userId ? parsed : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const getUserId = (value) =>
  value?.userId || value?.id || value?._id || value?.user?.id || value?.user?._id || null;

const getMemberships = (value) => {
  if (!value) return [];
  if (Array.isArray(value.memberships)) return value.memberships;
  if (Array.isArray(value.access_rights)) return value.access_rights;
  if (Array.isArray(value.user?.memberships)) return value.user.memberships;
  if (Array.isArray(value.user?.access_rights)) return value.user.access_rights;
  return [];
};

const normalizeUser = (value, fallback = {}) => {
  if (!value) {
    return fallback.userId ? { id: fallback.userId, _id: fallback.userId, memberships: [] } : null;
  }

  const baseUser = value.user && typeof value.user === "object" ? value.user : value;
  const id = getUserId(baseUser) || getUserId(value) || fallback.userId || null;
  const memberships = getMemberships(value);

  return {
    ...baseUser,
    id,
    _id: baseUser._id || id,
    memberships,
    access_rights: baseUser.access_rights || memberships,
  };
};

const isInvalidSessionError = (err) => {
  const status = Number(err?.status);
  const message = String(err?.message || "").toLowerCase();
  return status === 401 || message.includes("invalid session") || message.includes("unauthorized");
};

const initialSession = readStoredSession();
const initialUser = initialSession ? normalizeUser(initialSession.user, initialSession) : null;

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(initialSession);
  const [user, setUser] = useState(initialUser);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(initialSession));
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [authError, setAuthError] = useState(null);

  const saveSession = useCallback((data, userSnapshot = null) => {
    if (!data?.userId || !data?.token) return;

    const safeSession = {
      userId: data.userId,
      token: data.token,
      workspaceId: data.workspaceId,
      user: userSnapshot ? normalizeUser(userSnapshot, data) : data.user || null,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSession));
    setSession(safeSession);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setUser(null);
    setActiveWorkspace(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const logout = useCallback(async () => {
    const userId = session?.userId;
    clearSession();

    try {
      await closeLocalDB(userId);
    } catch (e) {
      console.warn("DB close failed", e);
    }
  }, [clearSession, session?.userId]);

  const verifySession = useCallback(async (sessionData, { clearOnInvalid = true } = {}) => {
    if (!sessionData?.userId || !sessionData?.token || !navigator.onLine) {
      return { valid: false, invalid: false, skipped: true };
    }

    try {
      setIsVerifyingSession(true);

      const res = await apiRequest("/auth/verify-session", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 5000,
        body: {
          userId: sessionData.userId,
          token: sessionData.token,
        },
      });

      if (!res?.success || !res?.user) {
        if (clearOnInvalid) clearSession();
        return { valid: false, invalid: true };
      }

      const verifiedUser = normalizeUser(res.user, sessionData);
      setUser(verifiedUser);
      saveSession(sessionData, verifiedUser);
      setIsAuthenticated(true);

      return { valid: true, invalid: false, user: verifiedUser };
    } catch (err) {
      if (isInvalidSessionError(err)) {
        if (clearOnInvalid) clearSession();
        return { valid: false, invalid: true, error: err };
      }

      console.warn("Background session verification failed:", err);
      return { valid: false, invalid: false, error: err };
    } finally {
      setIsVerifyingSession(false);
    }
  }, [clearSession, saveSession]);

  useEffect(() => {
    const stored = readStoredSession();

    if (!stored) {
      setIsLoadingAuth(false);
      return;
    }

    const hydratedUser = normalizeUser(stored.user, stored);
    setSession(stored);
    setUser(hydratedUser);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);

    verifySession(stored, { clearOnInvalid: true });
  }, [verifySession]);

  useEffect(() => {
    const handleOnline = () => {
      const stored = readStoredSession();
      if (!stored) return;
      verifySession(stored, { clearOnInvalid: true });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [verifySession]);

  const login = useCallback(async ({ phone, pin }) => {
    try {
      setIsLoadingAuth(false);
      setAuthError(null);

      const data = await apiRequest("/login", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 0,
        body: { username: phone, password: pin },
      });

      if (!data?.success) {
        throw new Error(data?.error || "Invalid credentials");
      }

      const userSession = data.user_session || data.user;
      const userId = getUserId(userSession) || data.user_id;

      if (!userId || !data.token) {
        throw new Error("Login response was missing session data");
      }

      const sessionData = {
        userId,
        token: data.token,
        workspaceId: data.workspace || data.workspace_id || data.db,
      };

      const normalizedUser = normalizeUser(userSession, sessionData);

      saveSession(sessionData, normalizedUser);
      setUser(normalizedUser);
      setIsAuthenticated(true);

      return sessionData;
    } catch (err) {
      setAuthError(err.message || "Login failed");
      throw err;
    }
  }, [saveSession]);

  const register = useCallback(async (formData) => {
    try {
      setAuthError(null);

      const data = await apiRequest("/register", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 0,
        body: formData,
      });

      if (!data?.success) {
        throw new Error(data?.error || "Registration failed");
      }

      const sessionData = {
        userId: data.user_id,
        token: data.token,
        workspaceId: data.workspace_id || data.db,
      };

      const fallbackUser = {
        id: data.user_id,
        _id: data.user_id,
        memberships: data.workspace_id
          ? [{ workspace_id: data.workspace_id, role: "owner", team_ids: [] }]
          : [],
      };

      const normalizedUser = normalizeUser(data.user || fallbackUser, sessionData);

      saveSession(sessionData, normalizedUser);
      setUser(normalizedUser);
      setIsAuthenticated(true);

      return data;
    } catch (err) {
      setAuthError(err.message || "Registration failed");
      throw err;
    }
  }, [saveSession]);

  const memberships = useMemo(() => getMemberships(user), [user]);
  const hasFullAccess = useMemo(
    () => memberships.some((m) => m.role === "owner" || m.role === "admin"),
    [memberships]
  );
  const hasOwnerAccess = useMemo(
    () => memberships.some((m) => m.role === "owner"),
    [memberships]
  );

  const value = useMemo(() => ({
    session,
    user,
    activeWorkspace,

    isAuthenticated,
    isLoadingAuth,
    isVerifyingSession,
    authError,
    hasFullAccess,
    hasOwnerAccess,

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
    isVerifyingSession,
    authError,
    hasFullAccess,
    hasOwnerAccess,
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

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
