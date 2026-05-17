import { createContext, useContext, useState, useCallback, useEffect } from "react";
import usePouchChanges from "@/hooks/usePouchChanges";
import { useAuth } from "@/lib/AuthContext";
import { getUserAccessMap, fetchedUserData } from "@/db/api";


const DataContext = createContext();

export function DataProvider({ children }) {
  const { isAuthenticated, session, setUser } = useAuth();
  const [hasMembers, setHasMembers] = useState(false);
  const [hasTeams, setHasTeam] = useState(false);

  // =========================
  // SAFE INITIAL STATE
  // =========================
  const [data, setData] = useState({
    tasks: [],
    teams: [],
    members: [],
    workspaces: [],
    timelogs: [],
    userList: [],
  });

  const [loading, setLoading] = useState(false);

  // =========================
  // SAFE LOADER
  // =========================
  const loadData = useCallback(async () => {
    if (!session) return;

    try {
      setLoading(true);

      const res = await fetchedUserData(session);

      // 🔥 CRITICAL: sanitize everything
      setData({
        tasks: res?.tasks ?? [],
        teams: res?.teams ?? [],
        members: res?.members ?? [],
        workspaces: res?.workspaces ?? [],
        timelogs: res?.timelogs ?? [],
        userList: res?.userList ?? [],
      });

      if (res?.members > 0) setHasMembers(true);
      if (res?.teams > 0) setHasTeam(true);


      const userAccess = await getUserAccessMap(session.userId);

      setUser(userAccess);

    } catch (err) {
      console.error("DataProvider loadData error:", err);

      // fallback safe state (NEVER leave undefined)
      setData({
        tasks: [],
        teams: [],
        members: [],
        workspaces: [],
        timelogs: [],
        userList: [],
      });

    } finally {
      setLoading(false);
    }
  }, [session]);

  // =========================
  // INITIAL LOAD (SAFE)
  // =========================
  useEffect(() => {
    if (!isAuthenticated) return;

    loadData();

  }, [session, loadData]);

  // =========================
  // REALTIME POUCHDB CHANGES
  // (debounced to avoid reload spam)
  // =========================


  usePouchChanges(session?.userId, (doc) => {
    if (!session?.userId || !doc) return;

    setData((prev) => {
      const next = { ...prev };

      // ======================
      // TASKS
      // ======================
      if (doc.type === "task") {
        if (doc._deleted) {
          next.tasks = prev.tasks.filter(
            (t) => t._id !== doc._id
          );
        } else {
          const exists = prev.tasks.some(
            (t) => t._id === doc._id
          );

          next.tasks = exists
            ? prev.tasks.map((t) =>
              t._id === doc._id ? doc : t
            )
            : [doc, ...prev.tasks];
        }
      }

      // ======================
      // TEAMS
      // ======================
      if (doc.type === "team") {
        if (doc._deleted) {
          next.teams = prev.teams.filter(
            (t) => t._id !== doc._id
          );
        } else {
          const exists = prev.teams.some(
            (t) => t._id === doc._id
          );

          next.teams = exists
            ? prev.teams.map((t) =>
              t._id === doc._id ? doc : t
            )
            : [doc, ...prev.teams];
        }
      }

      return next;
    });
  });

  // =========================
  // SAFE CONTEXT VALUE
  // =========================
  const safeData = {
    tasks: data.tasks ?? [],
    teams: data.teams ?? [],
    members: data.members ?? [],
    workspaces: data.workspaces ?? [],
    timelogs: data.timelogs ?? [],
    userList: data.userList ?? [],
    hasMembers,
    hasTeams
  };

  return (
    <DataContext.Provider
      value={{
        ...safeData,
        reload: loadData,
        loading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useAppData = () => useContext(DataContext);