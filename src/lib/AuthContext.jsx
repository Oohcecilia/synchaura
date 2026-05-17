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
const STORAGE_KEY = "session";

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
  if (!value) return null;

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

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

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

  const logout = useCallback(async () => {
    const userId = session?.userId;

    setSession(null);
    setUser(null);
    setActiveWorkspace(null);
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY);

    try {
      await resetLocalDB(userId);
    } catch (e) {
      console.warn("DB reset failed", e);
    }
  }, [session?.userId]);

  const verifySession = useCallback(async (sessionData) => {
    try {
      const res = await apiRequest("/auth/verify-session", {
        method: "POST",
        requireAuth: false,
        body: {
          userId: sessionData.userId,
          token: sessionData.token,
        },
      });

      if (!res?.success || !res?.user) return false;

      setUser(normalizeUser(res.user, sessionData));
      return true;
    } catch (err) {
      return false;
    }
  }, []);

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

        if (!navigator.onLine) {
          setIsAuthenticated(true);
          setUser(normalizeUser(parsed.user, parsed));
          return;
        }

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
        setIsLoadingAuth(false);
      }
    };

    init();
  }, [verifySession]);

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
    return () => window.removeEventListener("online", handleOnline);
  }, [verifySession, logout]);

  const login = useCallback(async ({ phone, pin }) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const data = await apiRequest("/login", {
        method: "POST",
        requireAuth: false,
        body: { username: phone, password: pin },
      });

      if (!data?.success) {
        throw new Error(data?.error || "Invalid credentials");
      }

      const sessionData = {
        userId: data.user_session?.id,
        token: data.token,
        workspaceId: data.workspace || data.db,
      };

      saveSession(sessionData);
      setUser(normalizeUser(data.user_session, sessionData));
      setIsAuthenticated(true);

      return sessionData;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoadingAuth(false);
    }
  }, [saveSession]);

  const register = useCallback(async (formData) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const data = await apiRequest("/register", {
        method: "POST",
        requireAuth: false,
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

      saveSession(sessionData);
      setUser(normalizeUser(data.user || fallbackUser, sessionData));
      setIsAuthenticated(true);

      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setIsLoadingAuth(false);
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
