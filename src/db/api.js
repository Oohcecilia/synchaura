import { getDB, getDocsByType, getDocsByTypes } from "./couch";

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

const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === "string") return user;
  return user.userId || user.id || user._id || user.user?.id || user.user?._id || null;
};

export async function fetchedUserData(user) {
  const userId = getUserId(user);

  if (!userId) return emptyState();

  const db = getDB(userId);
  if (!db) return emptyState();

  try {
    const docs = await getDocsByTypes(db, [
      "membership",
      "workspace",
      "task",
      "team",
      "timelog",
      "user",
    ]);


    const byType = docs.reduce((acc, doc) => {
      if (!doc?.type) return acc;
      acc[doc.type] = acc[doc.type] || [];
      acc[doc.type].push(doc);
      return acc;
    }, {});

    const memberships = byType.membership || [];
    const workspaces = byType.workspace || [];

    const myMemberships = memberships.filter((m) => String(m.user_id) === String(userId));

    if (!myMemberships.length) return emptyState();

    const workspaceIds = new Set(myMemberships.map((m) => m.workspace_id));
    const inUserWorkspace = (doc) => doc.workspace_id && workspaceIds.has(doc.workspace_id);
    const getMembershipForWorkspace = (workspaceId) =>
      myMemberships.find((m) => m.workspace_id === workspaceId);

    const tasks = (byType.task || []).filter(inUserWorkspace);
    const teams = (byType.team || []).filter(inUserWorkspace);
    const timelogs = (byType.timelog || []).filter(inUserWorkspace);
    const filteredWorkspaces = workspaces.filter((workspace) => workspaceIds.has(workspace._id));

    const workspaceMembers = memberships.filter((membership) => workspaceIds.has(membership.workspace_id));
    const memberIds = new Set(workspaceMembers.map((membership) => membership.user_id));
    const members = (byType.user || []).filter((member) => memberIds.has(member._id));

    const filteredTasks = tasks.filter((task) => {
      const membership = getMembershipForWorkspace(task.workspace_id);
      if (!membership) return false;

      const role = membership.role;
      const myTeamIds = Array.isArray(membership.team_ids) ? membership.team_ids : [];

      if (role === "owner" || role === "admin") return true;

      if (role === "member") {
        const taskTeams = Array.isArray(task.team_id)
          ? task.team_id
          : [task.team_id].filter(Boolean);

        return taskTeams.some((teamId) => myTeamIds.includes(teamId));
      }

      return false;
    });

    const userList = members.map((member) => ({
      user_id: member._id,
      phone: member.phone,
      first_name: member.first_name,
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
    console.error("PouchDB Fetch Error:", err);
    return emptyState();
  }
}

export async function getNotifications(user) {
  const userId = getUserId(user);
  if (!userId) return { notifications: [], unreadCount: 0 };

  const db = getDB(userId);
  if (!db) return { notifications: [], unreadCount: 0 };

  try {
    const docs = await getDocsByTypes(db, ["membership", "notification"]);
    const memberships = docs.filter((doc) => doc.type === "membership");
    const notificationDocs = docs.filter((doc) => doc.type === "notification");

    const workspaceIds = memberships
      .filter((membership) => {
        const isMember = String(membership.user_id) === String(userId);
        const isIncluded =
          Array.isArray(membership.user_ids) &&
          membership.user_ids.some((id) => String(id) === String(userId));

        return isMember || isIncluded;
      })
      .map((membership) => String(membership.workspace_id));

    const notifications = notificationDocs
      .filter((notification) => {
        const notificationUserId = notification.user_id ? String(notification.user_id) : null;
        const notificationWorkspaceId = notification.workspace_id || notification.org_id;

        if (notificationUserId === String(userId)) return true;
        if (notification.category === "info") return true;

        return notificationWorkspaceId
          ? workspaceIds.includes(String(notificationWorkspaceId))
          : false;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );

    const unreadCount = notifications.filter((notification) => {
      const readList = Array.isArray(notification.read) ? notification.read : [];
      return !readList.some((id) => String(id) === String(userId));
    }).length;

    return { notifications, unreadCount };
  } catch (err) {
    console.error("Notification Error:", err);
    return { notifications: [], unreadCount: 0 };
  }
}

export async function getTasksLogs(userId, taskId) {
  const db = getDB(userId);
  if (!db) return { allLogs: [] };

  try {
    const logs = (await getDocsByType(db, "timelog"))
      .filter((doc) => String(doc.task_id) === String(taskId));

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
    const team = await db.get(teamId);

    if (team.type !== "team") {
      console.warn(`Document ${teamId} is not a team.`);
      return { team: null };
    }

    return { team };
  } catch (err) {
    if (err.status !== 404) {
      console.error("Get team error:", err);
    }
    return { team: null };
  }
}

export async function getUser(userId) {
  const db = getDB(userId);
  if (!db || !userId) return null;

  try {
    return await db.get(userId);
  } catch (err) {
    if (err.status !== 404) {
      console.error("Get user error:", err);
    }
    return null;
  }
}

export async function getUserAccessMap(userId) {
  if (!userId) return { user: null, memberships: [] };

  const db = getDB(userId);
  if (!db) return { user: null, memberships: [] };

  try {
    const [users, memberships] = await Promise.all([
      getDocsByType(db, "user"),
      getDocsByType(db, "membership"),
    ]);

    const user = users.find((doc) => String(doc._id) === String(userId)) || null;

    const myMemberships = memberships
      .filter((doc) => String(doc.user_id) === String(userId))
      .map((membership) => ({
        workspace_id: membership.workspace_id,
        role: membership.role || "member",
        team_ids: Array.isArray(membership.team_ids) ? membership.team_ids : [],
      }));

    return {
      user,
      memberships: myMemberships,
    };
  } catch (err) {
    console.error("getUserAccessMap error:", err);
    return { user: null, memberships: [] };
  }
}

export async function getDocument(type, id, userId = id) {
  if (!type || !id || !userId) return null;

  const db = getDB(userId);
  if (!db) return null;

  try {
    const doc = await db.get(id);
    return doc.type === type ? doc : null;
  } catch (error) {
    if (error.status !== 404) {
      console.error(`[getDocument] ${type}/${id}`, error);
    }
    return null;
  }
}

export async function hasTaskAccess(user, task) {
  if (!user || !task) return false;

  const userId = getUserId(user);
  const db = getDB(userId);
  const memberships = await getDocsByType(db, "membership");

  const membership = memberships.find(
    (entry) =>
      entry.workspace_id === task.workspace_id &&
      String(entry.user_id) === String(userId)
  );

  return Boolean(membership);
}
