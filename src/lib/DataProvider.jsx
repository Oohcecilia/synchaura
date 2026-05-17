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

  const loadData = useCallback(async () => {
    if (!session?.userId) return;

    try {
      setLoading(true);

      const res = await fetchedUserData(session);
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

      const userAccess = await getUserAccessMap(session.userId);
      setUser((prev) => ({
        ...(prev || {}),
        ...(userAccess.user || {}),
        id: session.userId,
        _id: session.userId,
        memberships: userAccess.memberships ?? [],
        access_rights: userAccess.memberships ?? [],
      }));
    } catch (err) {
      console.error("DataProvider loadData error:", err);
      setData(EMPTY_DATA);
      setHasMembers(false);
      setHasTeam(false);
    } finally {
      setLoading(false);
    }
  }, [session?.userId, setUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, loadData]);

  usePouchChanges(session?.userId, (doc) => {
    if (!session?.userId || !doc) return;

    if (!["task", "team"].includes(doc.type)) {
      loadData();
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
        reload: loadData,
        loading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useAppData = () => useContext(DataContext);
