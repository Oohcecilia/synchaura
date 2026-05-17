import { DoorClosed } from "lucide-react";
import { getDB } from "./couch";

// =========================
// SAFE EMPTY STATE
// =========================
function emptyState() {
  return {
    tasks: [],
    teams: [],
    members: [],
    workspaces: [],
    timelogs: [],
    userList: [],
  };
}

export async function fetchedUserData(user) {

  if (!user?.userId) return emptyState();

  const db = getDB(user.userId);
  if (!db) return emptyState();

  try {
    const result = await db.allDocs({ include_docs: true });
    const allDocs = result.rows.map((row) => row.doc).filter(Boolean);

    // =========================
    // CORE COLLECTIONS
    // =========================
    const memberships = allDocs.filter((d) => d.type === "membership");
    const workspaces = allDocs.filter((d) => d.type === "workspace");

    // =========================
    // USER MEMBERSHIPS
    // =========================
    const myMemberships = memberships.filter(
      (m) => m.user_id === user.userId
    );

    if (!myMemberships.length) return emptyState();

    // 👉 ALL workspace IDs the user belongs to
    const workspaceIds = new Set(
      myMemberships.map((m) => m.workspace_id)
    );

    // =========================
    // HELPERS
    // =========================
    const inUserWorkspace = (doc) =>
      doc.workspace_id && workspaceIds.has(doc.workspace_id);

    const getMembershipForWorkspace = (workspaceId) =>
      myMemberships.find((m) => m.workspace_id === workspaceId);

    // =========================
    // ENTITIES (MULTI-WORKSPACE)
    // =========================
    const tasks = allDocs.filter(
      (d) => d.type === "task" && inUserWorkspace(d)
    );


    const teams = allDocs.filter(
      (d) => d.type === "team" && inUserWorkspace(d)
    );

    const timelogs = allDocs.filter(
      (d) => d.type === "timelog" && inUserWorkspace(d)
    );

    const filteredWorkspaces = workspaces.filter((w) =>
      workspaceIds.has(w._id)
    );

    // =========================
    // MEMBERS (across all workspaces)
    // =========================
    const workspaceMembers = memberships.filter((m) =>
      workspaceIds.has(m.workspace_id)
    );

    const memberIds = new Set(
      workspaceMembers.map((m) => m.user_id)
    );

    const members = allDocs.filter(
      (d) => d.type === "user" && memberIds.has(d._id)
    );

    // =========================
    // RBAC TASK FILTER (PER WORKSPACE)
    // =========================
    const filteredTasks = tasks.filter((task) => {
      const membership = getMembershipForWorkspace(task.workspace_id);
      if (!membership) return false;

      const role = membership.role;
      const myTeamIds = Array.isArray(membership.team_ids)
        ? membership.team_ids
        : [];

      if (role === "owner" || role === "admin") return true;

      if (role === "member") {
        const taskTeams = Array.isArray(task.team_id)
          ? task.team_id
          : [task.team_id].filter(Boolean);

        return taskTeams.some((tid) =>
          myTeamIds.includes(tid)
        );
      }

      return false;
    });

    // =========================
    // USER LIST
    // =========================
    const userList = members.map((u) => ({
      user_id: u._id,
      phone: u.phone,
      first_name: u.first_name,
    }));


    return {
      tasks: filteredTasks,
      teams,
      members,
      workspaces: filteredWorkspaces,
      timelogs,
      userList,
    };
  } catch (err) {
    console.error("❌ PouchDB Fetch Error:", err);
    return emptyState();
  }
}




export async function getNotifications(user) {
  const db = getDB(user?.id);
  const userId = String(user?._id);

  if (!db) return { notifications: [], unreadCount: 0 };

  try {
    const result = await db.allDocs({ include_docs: true });
      
    const allDocs = result.rows
      .map((row) => row.doc)
      .filter(Boolean);
      

    // Workspaces where user has access
    const workspaceIds = allDocs
      .filter((doc) => {
        if (doc?.type !== "membership") {
          return false;
        }

        const isOwner =
          String(doc.user_id) === userId;

        const isIncluded =
          Array.isArray(doc.user_ids) &&
          doc.user_ids.some(
            (id) => String(id) === userId
          );

        return isOwner || isIncluded;
      })
      .map((m) => String(m.workspace_id));

    // Notifications
    const notifications = allDocs
      .filter((notif) => {
        if (notif?.type !== "notification") {
          return false;
        }

        // Personal notification
        if (
          String(notif.user_id) === userId
        ) {
          return true;
        }

        // Public info notifications
        if (notif.category === "info") {
          return true;
        }

        // Workspace access
        return workspaceIds.includes(
          String(notif.workspace_id)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );

    // Unread count
    const unreadCount = notifications.filter((n) => {
      const readList = Array.isArray(n.read)
        ? n.read
        : [];

      return !readList.some(
        (id) => String(id) === userId
      );
    }).length;

    console.log("NOTIF:", notifications);



    return {
      notifications,
      unreadCount,
    };
  } catch (err) {
    console.error("❌ Notification Error:", err);
    return { notifications: [], unreadCount: 0 };
  }
}


export async function getTasksLogs(userId, taskId) {
  const db = getDB(userId);

  if (!db) return { allLogs: [] };

  try {
    // 1. Get every document in the database
    const result = await db.allDocs({ include_docs: true });

    // 2. Extract the 'doc' from each row and apply your filters
    const logs = result.rows
      .map((row) => row.doc) // Extract the document
      .filter((doc) =>
        doc.type === "timelogs" &&
        String(doc.task_id) === String(taskId)
      );

    // 3. Sort and return
    return {
      allLogs: logs.sort((a, b) => {
        const aTime = a.created_at || a.started_at || "";
        const bTime = b.created_at || b.started_at || "";
        return bTime.localeCompare(aTime);
      }),
    };
  } catch (err) {
    console.error("Error fetching task logs:", err);
    return { allLogs: [] };
  }
}


export async function getTeam(teamId, userId) {
  const db = getDB(userId);
  if (!db || !teamId) return { team: null };

  try {
    // PouchDB fetches by ID directly from the single bucket
    const team = await db.get(teamId);

    // Optional: Safety check to ensure we didn't accidentally grab a different doc type
    if (team.type !== "team") {
      console.warn(`Document ${teamId} is not a team.`);
      return { team: null };
    }

    return { team };
  } catch (err) {
    // PouchDB throws a 404 error if not found
    if (err.status !== 404) {
      console.error("❌ Get team error:", err);
    }
    return { team: null };
  }
}

/**
 * Fetches a specific user document by ID
 */
export async function getUser(userId) {
  const db = getDB(userId);
  if (!db || !userId) return null;

  try {
    const userDoc = await db.get(userId);

    return userDoc;
  } catch (err) {
    if (err.status !== 404) {
      console.error("❌ Get user error:", err);
    }
    return null;
  }
}


export async function getUserAccessMap(userId) {
  if (!userId) return { user: null, memberships: [] };

  const db = getDB(userId);
  if (!db) return { user: null, memberships: [] };

  try {
    const result = await db.allDocs({ include_docs: true });
    const docs = result.rows.map((r) => r.doc).filter(Boolean);

    // =========================
    // USER (single object)
    // =========================
    const user = docs.find(
      (doc) =>
        doc?.type === "user" &&
        String(doc._id) === String(userId)
    ) || null;

    // =========================
    // MEMBERSHIPS
    // =========================
    const memberships = docs
      .filter(
        (doc) =>
          doc?.type === "membership" &&
          String(doc.user_id) === String(userId)
      )
      .map((m) => ({
        workspace_id: m.workspace_id,
        role: m.role || "member",
        team_ids: Array.isArray(m.team_ids) ? m.team_ids : [],
      }));

    // =========================
    // FINAL SHAPE
    // =========================
    return {
      user,
      memberships,
    };

  } catch (err) {
    console.error("❌ getUserAccessMap error:", err);
    return { user: null, memberships: [] };
  }
}


export async function getDocument(type, id) {
  if (!type || !id) return null;

  const db = getDB(id);
  if (!db) return null;

  try {
    const result = await db.allDocs({ include_docs: true });

    const docs = result.rows
      .map((r) => r.doc)
      .filter(Boolean);

    return docs.find(
      (doc) => doc.type === type && doc._id === id
    ) || null;

  } catch (error) {
    console.error(`[getDocument] ${type}/${id}`, error);
    return null;
  }
}




export async function hasTaskAccess(user, task) {
  if (!user || !task) return false;

  const wsId = String(task.workspace_id);

  const membership = await getDocument("membership", wsId);

  const hasAccess =
    membership?.user_id === user?._id ||
    membership?.user_ids?.includes(user?._id);


  if (!hasAccess) return false;

  return true;
}



// export async function appPrivilage(userId) {
//   if (!userId) return { user: null, memberships: [] };

//   const db = getDB(userId);
//   if (!db) return { user: null, memberships: [] };

//   try {
//     const result = await db.allDocs({ include_docs: true });
//     const docs = result.rows.map((r) => r.doc).filter(Boolean);

//     const accountType = docs
//     .filter(
//       (doc) =>
//         doc?.type === "workspace" &&
//         String(doc.owner_id) === String(userId)
//     )

//     const memberships = docs
//       .filter(
//         (doc) =>
//           doc?.type === "membership" &&
//           String(doc.user_id) === String(userId)
//       )
//       .map((m) => ({
//         workspace_id: m.workspace_id,
//         role: m.role || "member",
//         team_ids: Array.isArray(m.team_ids) ? m.team_ids : [],
//       }));
//   };

  
// }
