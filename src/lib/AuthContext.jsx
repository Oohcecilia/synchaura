import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { apiRequest } from "@/api/client";
import { closeLocalDB } from "@/db/couch";

const AuthContext = createContext();
const STORAGE_KEY = "session";
const LEGACY_STORAGE_KEYS = ["token", "auth_token"];
const EMPTY_MEMBERSHIPS = [];

const isSameSession = (a, b) =>
  Boolean(a?.userId && a?.token && b?.userId && b?.token) &&
  String(a.userId) === String(b.userId) &&
  String(a.token) === String(b.token);

const clearAuthStorage = () => {
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

const readStoredSession = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return parsed?.token && parsed?.userId ? parsed : null;
  } catch {
    clearAuthStorage();
    return null;
  }
};

const getUserId = (value) =>
  value?.userId || value?.id || value?._id || value?.user?.id || value?.user?._id || null;

const stripMembershipFields = (value) => {
  if (!value) return null;
  const { memberships, access_rights, ...rest } = value;
  return rest;
};

const getMemberships = (value) => {
  if (!value) return [];
  if (Array.isArray(value.memberships)) return value.memberships;
  if (Array.isArray(value.access_rights)) return value.access_rights;
  if (Array.isArray(value.session?.memberships)) return value.session.memberships;
  if (Array.isArray(value.session?.access_rights)) return value.session.access_rights;
  if (Array.isArray(value.user?.memberships)) return value.user.memberships;
  if (Array.isArray(value.user?.access_rights)) return value.user.access_rights;
  return [];
};

const normalizeUser = (value, fallback = {}) => {
  if (!value) {
    return fallback.userId ? { id: fallback.userId, _id: fallback.userId } : null;
  }

  const baseUser = value.user && typeof value.user === "object" ? value.user : value;
  const cleanUser = stripMembershipFields(baseUser);
  const id = getUserId(baseUser) || getUserId(value) || fallback.userId || null;

  return {
    ...cleanUser,
    id,
    _id: cleanUser._id || id,
  };
};

const isInvalidSessionError = (err) => {
  const status = Number(err?.status);
  const message = String(err?.message || "").toLowerCase();
  return status === 401 || message.includes("invalid session") || message.includes("unauthorized");
};

const initialSession = readStoredSession();
const initialUser = initialSession ? normalizeUser(initialSession.user, initialSession) : null;
const initialMemberships = getMemberships(initialSession);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(initialSession);
  const [user, setUser] = useState(initialUser);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(initialSession));
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [authError, setAuthError] = useState(null);
  const sessionRef = useRef(initialSession);
  const membershipsRef = useRef(initialMemberships);

  useEffect(() => {
    membershipsRef.current = memberships;
  }, [memberships]);

  const saveSession = useCallback((data, userSnapshot = null) => {
    if (!data?.userId || !data?.token) return;

    const nextMemberships = getMemberships(data);
    const resolvedMemberships = nextMemberships.length ? nextMemberships : membershipsRef.current;
    const safeSession = {
      userId: data.userId,
      token: data.token,
      memberships: resolvedMemberships,
      user: userSnapshot ? normalizeUser(userSnapshot, data) : data.user || null,
    };

    clearAuthStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSession));
    sessionRef.current = safeSession;
    setSession(safeSession);
    setMemberships(resolvedMemberships);
    setIsLoadingAuth(false);
    setIsVerifyingSession(false);
  }, []);

  const clearSession = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setMemberships(EMPTY_MEMBERSHIPS);
    setActiveWorkspace(null);
    setIsAuthenticated(false);
    setIsLoadingAuth(false);
    setIsVerifyingSession(false);
    setAuthError(null);
    clearAuthStorage();
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
      const requestSession = {
        userId: sessionData.userId,
        token: sessionData.token,
      };

      const res = await apiRequest("/auth/verify-session", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 5000,
        body: {
          userId: sessionData.userId,
          token: sessionData.token,
        },
      });

      if (!isSameSession(sessionRef.current, requestSession)) {
        return { valid: false, invalid: false, skipped: true };
      }

      if (!res?.success || !res?.user) {
        if (clearOnInvalid && isSameSession(sessionRef.current, requestSession)) {
          clearSession();
        }
        return { valid: false, invalid: true };
      }

      const verifiedUser = normalizeUser(res.user, sessionData);
      setUser(verifiedUser);
      saveSession(sessionData, verifiedUser);
      setIsAuthenticated(true);

      return { valid: true, invalid: false, user: verifiedUser };
    } catch (err) {
      if (isInvalidSessionError(err)) {
        if (clearOnInvalid && isSameSession(sessionRef.current, sessionData)) {
          clearSession();
        }
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
      clearAuthStorage();
      setIsLoadingAuth(false);
      return;
    }

    const hydratedUser = normalizeUser(stored.user, stored);
    sessionRef.current = stored;
    setSession(stored);
    setUser(hydratedUser);
    setMemberships(getMemberships(stored));
    setIsAuthenticated(true);
    setIsLoadingAuth(false);

    verifySession(stored, { clearOnInvalid: true });
  }, [verifySession]);

  useEffect(() => {
    const handleOnline = () => {
      const stored = readStoredSession();
      if (!stored) return;
      sessionRef.current = stored;
      verifySession(stored, { clearOnInvalid: true });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [verifySession]);

  // const login = useCallback(async ({ phone, password }) => {
  //   try {
  //     setIsLoadingAuth(false);
  //     setAuthError(null);

  //     console.log(`phone ${phone} pwd ${password}`);

  //     const data = await apiRequest("/login", {
  //       method: "POST",
  //       requireAuth: false,
  //       timeoutMs: 0,
  //       body: { username: phone, password },
  //     });

  //     console.log(`LOGIN LOG ${JSON.stringify(data)}`);

  //     if (!data?.success) {
  //       throw new Error(data?.error || "Invalid credentials");
  //     }

  //     const userSession = data.user_session || data.user;
  //     const userId = getUserId(userSession) || data.user_id;

  //     if (!userId || !data.token) {
  //       throw new Error("Login response was missing session data");
  //     }

  //     const sessionData = {
  //       userId,
  //       token: data.token,
  //       workspaceId: data.workspace || data.workspace_id || data.db,
  //     };
  //     sessionData.mustChangePassword = Boolean(data.must_change_password);

  //     const normalizedUser = normalizeUser(userSession, sessionData);

  //     saveSession(sessionData, normalizedUser);
  //     setUser(normalizedUser);
  //     setIsAuthenticated(true);

  //     return sessionData;
  //   } catch (err) {
  //     setAuthError(err.message || "Login failed");
  //     throw err;
  //   }
  // }, [saveSession]);


  const login = useCallback(async ({ phone, password }) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const data = await apiRequest("/login", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 15000,
        body: { username: phone, password },
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
        memberships: getMemberships(data),
      };
      sessionData.mustChangePassword = Boolean(data.must_change_password);

      const normalizedUser = normalizeUser(userSession, sessionData);

      saveSession(sessionData, normalizedUser);
      setUser(normalizedUser);
      setIsAuthenticated(true);

      return sessionData;
    } catch (err) {
      setAuthError(err.message || "Login failed");
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [saveSession]);

  const completeOAuthSession = useCallback((payload) => {
    if (!payload?.token || !payload?.userId) {
      throw new Error("Google login failed");
    }

    const normalizedUser = normalizeUser(payload.user || null, {
      userId: payload.userId,
      token: payload.token,
    });

    const sessionData = {
      userId: payload.userId,
      token: payload.token,
      workspaceId: payload.workspaceId || payload.user?.workspaceId || null,
      memberships: getMemberships(payload),
      user: payload.user || normalizedUser,
    };

    setAuthError(null);
    saveSession(sessionData, normalizedUser);
    setUser(normalizedUser);
    setIsAuthenticated(true);

    return {
      session: sessionData,
      user: normalizedUser,
    };
  }, [saveSession]);

  const register = useCallback(async (formData) => {
    try {
      setAuthError(null);

      const data = await apiRequest("/register", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 15000,
        body: formData,
      });

      if (!data?.success) {
        throw new Error(data?.error || "Registration failed");
      }

      const sessionData = {
        userId: data.user_id,
        token: data.token,
        workspaceId: data.workspace_id || data.db,
        memberships: getMemberships(data),
      };

      const fallbackUser = {
        id: data.user_id,
        _id: data.user_id,
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

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    if (!session?.userId || !session?.token) {
      throw new Error("You need to be signed in to change your password");
    }

    try {
      setAuthError(null);

      const data = await apiRequest("/auth/change-password", {
        method: "POST",
        requireAuth: false,
        timeoutMs: 0,
        body: {
          userId: session.userId,
          token: session.token,
          currentPassword,
          newPassword,
        },
      });

      if (!data?.success) {
        throw new Error(data?.detail || data?.error || "Password update failed");
      }

      if (data?.user) {
        const normalizedUser = normalizeUser(data.user, session);
        setUser(normalizedUser);
        saveSession({
          ...session,
          user: normalizedUser,
        }, normalizedUser);
      }

      return data;
    } catch (err) {
      setAuthError(err.message || "Password update failed");
      throw err;
    }
  }, [saveSession, session]);

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
    memberships,
    hasFullAccess,
    hasOwnerAccess,

    login,
    completeOAuthSession,
    register,
    changePassword,
    logout,
    setUser,
    setMemberships,
    setAuthError,
  }), [
    session,
    user,
    memberships,
    activeWorkspace,
    isAuthenticated,
    isLoadingAuth,
    isVerifyingSession,
    authError,
    hasFullAccess,
    hasOwnerAccess,
    login,
    completeOAuthSession,
    register,
    changePassword,
    logout,
    setMemberships,
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
