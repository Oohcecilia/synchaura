const toIdSet = (values = []) =>
  new Set(
    values
      .filter(Boolean)
      .map((value) => String(value))
  );

const getTaskTeamIds = (task) => {
  if (!task) return [];
  if (Array.isArray(task.team_id)) return task.team_id.filter(Boolean).map(String);
  if (Array.isArray(task.team_ids)) return task.team_ids.filter(Boolean).map(String);
  return [task.team_id].filter(Boolean).map(String);
};

export const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === "string") return user;
  return user.userId || user.id || user._id || user.user?.id || user.user?._id || null;
};

export const userCanAccessTask = (userId, task, memberships = []) => {
  if (!userId || !task) return false;

  const normalizedUserId = String(userId);
  const assignedIds = toIdSet(Array.isArray(task.assigned_to) ? task.assigned_to : []);
  if (assignedIds.has(normalizedUserId)) return true;

  const membership = memberships.find(
    (entry) =>
      String(entry?.user_id) === normalizedUserId &&
      String(entry?.workspace_id) === String(task.workspace_id)
  );

  if (!membership) return false;

  const role = String(membership.role || "member").toLowerCase();
  if (role === "owner" || role === "admin") return true;

  const taskTeamIds = getTaskTeamIds(task);
  if (!taskTeamIds.length) return false;

  const userTeamIds = toIdSet(Array.isArray(membership.team_ids) ? membership.team_ids : []);
  return taskTeamIds.some((teamId) => userTeamIds.has(String(teamId)));
};

export const canUserDeleteTask = ({ userId, task, memberships = [], hasFullAccess = false }) => {
  if (!userId || !task) return false;

  if (hasFullAccess) return true;

  const normalizedUserId = String(userId);
  const creatorId = task.created_by || task.owner_id || task.user_id || null;
  if (creatorId && String(creatorId) === normalizedUserId) return true;

  const membership = memberships.find(
    (entry) =>
      String(entry?.user_id) === normalizedUserId &&
      String(entry?.workspace_id) === String(task.workspace_id)
  );

  if (!membership) return false;

  const role = String(membership.role || "member").toLowerCase();
  return role === "owner" || role === "admin";
};
