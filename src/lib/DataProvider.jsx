import { createContext, useContext, useState, useCallback, useEffect } from "react";
import usePouchChanges from "@/hooks/usePouchChanges";
import { useAuth } from "@/lib/AuthContext";
import { getUserAccessMap, fetchedUserData } from "@/db/api";

const DataContext = createContext();

const EMPTY_DATA = {
  tasks: [],
  teams: [],
  members: [],
  workspaces: [],
  timelogs: [],
  userList: [],
};

export function DataProvider({ children }) {
  const { isAuthenticated, session, setUser } = useAuth();
  const [hasMembers, setHasMembers] = useState(false);
  const [hasTeams, setHasTeam] = useState(false);
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const applyData = useCallback((res) => {
    const nextData = {
      tasks: res?.tasks ?? [],
      teams: res?.teams ?? [],
      members: res?.members ?? [],
      workspaces: res?.workspaces ?? [],
      timelogs: res?.timelogs ?? [],
      userList: res?.userList ?? [],
    };

    setData(nextData);
    setHasMembers(nextData.members.length > 0);
    setHasTeam(nextData.teams.length > 0);
  }, []);

  const refreshUserAccess = useCallback(async () => {
    if (!session?.userId) return;

    try {
      const userAccess = await getUserAccessMap(session.userId);
      setUser((prev) => ({
        ...(prev || {}),
        ...(userAccess.user || {}),
        id: session.userId,
        _id: session.userId,
        memberships: userAccess.memberships ?? prev?.memberships ?? [],
        access_rights: userAccess.memberships ?? prev?.access_rights ?? [],
      }));
    } catch (err) {
      console.warn("Background user access refresh failed:", err);
    }
  }, [session?.userId, setUser]);

  const loadData = useCallback(async ({ background = false } = {}) => {
    if (!session?.userId) return;

    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      const res = await fetchedUserData(session);
      applyData(res);

      // Access refresh is useful, but should not delay local data rendering.
      refreshUserAccess();
    } catch (err) {
      console.warn("DataProvider loadData error:", err);
      if (!background) {
        applyData(EMPTY_DATA);
      }
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }, [session, applyData, refreshUserAccess]);

  useEffect(() => {
    if (!isAuthenticated || !session?.userId) return;

    // Local-first load. This reads local PouchDB data and should finish quickly;
    // it does not wait for remote sync or auth verification.
    loadData({ background: false });
  }, [isAuthenticated, session?.userId, loadData]);

  usePouchChanges(session?.userId, (doc) => {
    if (!session?.userId || !doc) return;

    if (!["task", "team"].includes(doc.type)) {
      loadData({ background: true });
      return;
    }

    setData((prev) => {
      const next = { ...prev };
      const collection = doc.type === "task" ? "tasks" : "teams";

      if (doc._deleted) {
        next[collection] = prev[collection].filter((item) => item._id !== doc._id);
      } else {
        const exists = prev[collection].some((item) => item._id === doc._id);
        next[collection] = exists
          ? prev[collection].map((item) => (item._id === doc._id ? doc : item))
          : [doc, ...prev[collection]];
      }

      if (collection === "teams") {
        setHasTeam(next.teams.length > 0);
      }

      return next;
    });
  });

  const safeData = {
    tasks: data.tasks ?? [],
    teams: data.teams ?? [],
    members: data.members ?? [],
    workspaces: data.workspaces ?? [],
    timelogs: data.timelogs ?? [],
    userList: data.userList ?? [],
    hasMembers,
    hasTeams,
  };


  return (
    <DataContext.Provider
      value={{
        ...safeData,
        reload: () => loadData({ background: true }),
        loading,
        refreshing,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useAppData = () => useContext(DataContext);
