import { nanoid } from "nanoid";
import { getDB } from "@/db/couch";

const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

const toIdSet = (values = []) =>
  new Set(
    values
      .filter(Boolean)
      .map((value) => String(value))
  );

const getUserId = (user) => {
  if (!user) return null;
  if (typeof user === "string") return user;
  return user.userId || user.id || user._id || user.user?.id || user.user?._id || null;
};

const getTaskTeamIds = (task) => {
  if (!task) return [];
  if (Array.isArray(task.team_id)) return task.team_id.filter(Boolean).map(String);
  if (Array.isArray(task.team_ids)) return task.team_ids.filter(Boolean).map(String);
  return [task.team_id].filter(Boolean).map(String);
};

export const isTaskCompleted = (task) =>
  ["completed", "done", "cancelled", "archived"].includes(String(task?.status || "").toLowerCase());

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

export const isNotificationVisibleToUser = ({
  notification,
  userId,
  memberships = [],
  taskById = new Map(),
}) => {
  if (!notification || !userId) return false;

  const normalizedUserId = String(userId);
  const directUserId = notification.user_id ? String(notification.user_id) : null;
  const recipientIds = toIdSet(notification.recipient_user_ids || notification.user_ids || []);

  if (directUserId === normalizedUserId || recipientIds.has(normalizedUserId)) {
    return true;
  }

  if (notification.task_id) {
    const task = taskById.get(String(notification.task_id));
    return userCanAccessTask(normalizedUserId, task, memberships);
  }

  return false;
};

function getDueState(task, now = new Date()) {
  if (!task?.due_date || isTaskCompleted(task)) return null;

  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return null;

  const msUntilDue = due.getTime() - now.getTime();
  if (msUntilDue < 0) return "task_overdue";
  if (msUntilDue <= DUE_SOON_WINDOW_MS) return "task_due_soon";
  return null;
}

async function putIfChanged(db, notification) {
  try {
    const existing = await db.get(notification._id);
    const dueChanged = existing.due_date !== notification.due_date;
    const titleChanged = existing.task_title !== notification.task_title;

    if (!dueChanged && !titleChanged) {
      return existing;
    }

    const updated = {
      ...existing,
      ...notification,
      read: dueChanged ? [] : existing.read || [],
      created_at: existing.created_at || notification.created_at,
      updated_at: new Date().toISOString(),
    };
    await db.put(updated);
    return updated;
  } catch (err) {
    if (err.status !== 404) throw err;
    await db.put(notification);
    return notification;
  }
}

export async function ensureDueTaskNotifications(db, userId, tasks = [], memberships = [], existingNotifications = []) {
  if (!db || !userId) return [];

  const taskById = new Map(tasks.map((task) => [String(task._id), task]));
  const existingById = new Map(existingNotifications.map((notification) => [notification._id, notification]));
  const now = new Date();
  const generated = [];

  for (const task of tasks) {
    if (!task?._id || !userCanAccessTask(userId, task, memberships)) continue;

    const category = getDueState(task, now);
    if (!category) continue;

    const notificationId = `notif_${category}_${task._id}_${userId}`;
    const due = new Date(task.due_date);
    const existing = existingById.get(notificationId);
    const notification = {
      ...(existing || {}),
      _id: notificationId,
      type: "notification",
      category,
      title: category === "task_overdue" ? "Task overdue" : "Task due soon",
      message:
        category === "task_overdue"
          ? `"${task.title}" is overdue.`
          : `"${task.title}" is due within 48 hours.`,
      task_id: task._id,
      task_title: task.title,
      due_date: due.toISOString(),
      workspace_id: task.workspace_id ?? null,
      org_id: task.org_id ?? task.workspace_id ?? null,
      team_id: task.team_id ?? null,
      user_id: userId,
      recipient_user_ids: [userId],
      read: existing?.read || [],
      status: "Pending",
      created_by: "system",
      created_at: existing?.created_at || now.toISOString(),
      updated_at: now.toISOString(),
    };

    const saved = await putIfChanged(db, notification);
    if (isNotificationVisibleToUser({ notification: saved, userId, memberships, taskById })) {
      generated.push(saved);
    }
  }

  return generated;
}

export const createNotification = async (payload, userId) => {
  const db = getDB(userId);
  if (!db) return;

  const notification = {
    _id: `notif_${nanoid()}`,
    type: "notification", // The "PouchDB Table" identifier
    category: payload.type, // "task_created", "task_assigned", etc.
    title: payload.title,
    message: payload.message,

    task_id: payload.task_id ?? null,
    org_id: payload.org_id ?? null,
    workspace_id: payload.workspace_id ?? payload.org_id ?? null,
    team_id: payload.team_id ?? null,

    user_id: payload.user_id ?? null,
    recipient_user_ids: Array.isArray(payload.recipient_user_ids)
      ? payload.recipient_user_ids
      : Array.isArray(payload.user_ids)
        ? payload.user_ids
        : [],
    created_by: payload.created_by ?? null,
    
    read: [],
    status: payload.status ?? "Pending",
    created_at: new Date().toISOString(),
  };

  await db.put(notification);

  // We don't really need the custom Event anymore if we use the usePouchChanges hook,
  // but keeping it doesn't hurt.
  window.dispatchEvent(new Event("notifications:changed"));

  return notification;
};
