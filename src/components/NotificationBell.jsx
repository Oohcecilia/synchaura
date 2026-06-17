import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  CheckCheck,
  X,
  CheckSquare,
  SquareChevronDown,
  UserPlus,
  Mail,
  Info,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { getNotifications } from "@/db/api";
import usePouchChanges from "@/hooks/usePouchChanges";
import { getDB } from "@/db/couch";
import { upsertMembershipAccess } from "@/db/helpers";

const typeConfig = {
  task_created: {
    icon: SquareChevronDown,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  task_updated: {
    icon: CheckSquare,
    color: "text-emerald-500",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  task_completed: {
    icon: CheckCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  task_assigned: {
    icon: UserPlus,
    color: "text-purple-500",
    bg: "bg-purple-100 dark:bg-purple-900/30",
  },
  task_due_soon: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  task_overdue: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
  invitation: {
    icon: Mail,
    color: "text-pink-500",
    bg: "bg-pink-100 dark:bg-pink-900/30",
  },
  info: {
    icon: Info,
    color: "text-sky-500",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
};

const positionClass = {
  right: "right-0",
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
};

const getUserId = (user) => user?.id || user?._id || user?.userId || user?.user?.id || null;
const getNotificationWorkspaceId = (notification) => notification.workspace_id || notification.org_id;

export default function NotificationBell({ position = "right" }) {
  const { user, session, memberships, setMemberships } = useAuth();
  const userId = getUserId(user) || session?.userId;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const calculateUnreadCount = useCallback((items) => {
    return items.filter((notification) => {
      const readList = Array.isArray(notification.read) ? notification.read : [];
      return !readList.some((id) => String(id) === String(userId));
    }).length;
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;

    try {
      const res = await getNotifications({ ...(user || {}), id: userId, _id: userId });
      const nextNotifications = res?.notifications || [];

      setNotifications(nextNotifications);
      setUnreadCount(
        typeof res?.unreadCount === "number"
          ? res.unreadCount
          : calculateUnreadCount(nextNotifications)
      );
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, [user, userId, calculateUnreadCount]);

  usePouchChanges(userId, (doc) => {
    if (!doc || doc.type !== "notification") return;
    load();
  }, "notification");

  usePouchChanges(userId, (doc) => {
    if (!doc || doc.type !== "task") return;
    load();
  }, "task");

  useEffect(() => {
    load();

    const handler = () => load();
    window.addEventListener("notifications:changed", handler);
    window.addEventListener("focus", handler);
    const interval = window.setInterval(() => {
      load();
    }, 60 * 1000);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.removeEventListener("notifications:changed", handler);
      window.removeEventListener("focus", handler);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [load]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateNotification = async (notif, updater) => {
    if (!userId) return null;

    const db = getDB(userId);
    const freshNotif = await db.get(notif._id);
    const updated = updater(freshNotif);

    await db.put(updated);
    return updated;
  };

  const acceptInvitation = async (notif) => {
    try {
      if (!userId) return;
      const workspaceId = getNotificationWorkspaceId(notif);
      await upsertMembershipAccess(notif.user_id, {
        workspace_id: workspaceId,
        role: notif.role || "member",
        team_ids: [],
      });

      if (String(notif.user_id) === String(userId)) {
        const currentMemberships = Array.isArray(memberships) ? memberships : [];
        const nextMemberships = currentMemberships.some((entry) => entry.workspace_id === workspaceId)
          ? currentMemberships.map((entry) =>
              entry.workspace_id === workspaceId
                ? { ...entry, workspace_id: workspaceId, role: notif.role || "member", team_ids: [] }
                : entry
            )
          : [
              ...currentMemberships,
              {
                workspace_id: workspaceId,
                role: notif.role || "member",
                team_ids: [],
              },
            ];

        setMemberships?.(nextMemberships);
      }

      const updatedNotif = await updateNotification(notif, (freshNotif) => {
        const readList = Array.isArray(freshNotif.read) ? freshNotif.read : [];
        const updatedRead = readList.some((id) => String(id) === String(userId))
          ? readList
          : [...readList, userId];

        return {
          ...freshNotif,
          status: "accepted",
          read: updatedRead,
          updated_at: new Date().toISOString(),
        };
      });

      if (updatedNotif) {
        setNotifications((prev) => {
          const next = prev.map((notification) =>
            notification._id === updatedNotif._id ? updatedNotif : notification
          );
          setUnreadCount(calculateUnreadCount(next));
          return next;
        });
      }
    } catch (err) {
      console.error("Accept invitation failed:", err);
    }
  };

  const rejectInvitation = async (notif) => {
    try {
      if (!userId) return;

      const updatedNotif = await updateNotification(notif, (freshNotif) => {
        const readList = Array.isArray(freshNotif.read) ? freshNotif.read : [];

        return {
          ...freshNotif,
          status: "rejected",
          read: readList.some((id) => String(id) === String(userId))
            ? readList
            : [...readList, userId],
          updated_at: new Date().toISOString(),
        };
      });

      if (updatedNotif) {
        setNotifications((prev) => {
          const next = prev.map((notification) =>
            notification._id === updatedNotif._id ? updatedNotif : notification
          );
          setUnreadCount(calculateUnreadCount(next));
          return next;
        });
      }
    } catch (err) {
      console.error("Reject invitation failed:", err);
    }
  };

  const markAllRead = async () => {
    try {
      if (!userId || !notifications.length) return;

      const db = getDB(userId);
      const now = new Date().toISOString();

      const docsToUpdate = notifications.map((notification) => {
        const currentRead = Array.isArray(notification.read) ? notification.read : [];
        return {
          ...notification,
          read: currentRead.some((id) => String(id) === String(userId))
            ? currentRead
            : [...currentRead, userId],
          updated_at: now,
        };
      });

      await db.bulkDocs(docsToUpdate);
      setNotifications(docsToUpdate);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const markRead = async (notif) => {
    if (!userId) return;

    try {
      const updatedNotif = await updateNotification(notif, (freshNotif) => {
        const currentRead = Array.isArray(freshNotif.read) ? freshNotif.read : [];

        if (currentRead.some((id) => String(id) === String(userId))) return freshNotif;

        return {
          ...freshNotif,
          read: [...currentRead, userId],
          updated_at: new Date().toISOString(),
        };
      });

      if (updatedNotif) {
        setNotifications((prev) => {
          const next = prev.map((notification) =>
            notification._id === updatedNotif._id ? updatedNotif : notification
          );
          setUnreadCount(calculateUnreadCount(next));
          return next;
        });
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 hover:bg-muted rounded-xl transition-colors"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute top-1 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-2 w-80 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden",
            positionClass[position]
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => {
                const cfg = typeConfig[notification.category] || typeConfig.info;
                const Icon = cfg.icon;
                const isInvitation = notification.category === "invitation";
                const isProcessed = notification.status === "accepted" || notification.status === "rejected";
                const readList = Array.isArray(notification.read) ? notification.read : [];
                const isUnread = !readList.some((id) => String(id) === String(userId));

                return (
                  <div
                    key={notification._id}
                    onClick={() => !isInvitation && markRead(notification)}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors border-b border-border last:border-0",
                      isUnread && "bg-primary/5",
                      !isInvitation && "cursor-pointer hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        cfg.bg
                      )}
                    >
                      <Icon className={cn("h-4 w-4", cfg.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold", isUnread && "text-foreground")}>
                        {notification.title}
                      </p>

                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>

                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(
                          new Date(notification.created_at || Date.now()),
                          { addSuffix: true }
                        )}
                      </p>

                      {isInvitation && (
                        <div className="flex gap-2 mt-2">
                          <button
                            disabled={isProcessed}
                            onClick={(e) => {
                              e.stopPropagation();
                              acceptInvitation(notification);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-md text-white transition",
                              isProcessed
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-green-500 hover:bg-green-600"
                            )}
                          >
                            {notification.status === "accepted" ? "Accepted" : "Accept"}
                          </button>

                          <button
                            disabled={isProcessed}
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectInvitation(notification);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-md text-white transition",
                              isProcessed
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-500 hover:bg-red-600"
                            )}
                          >
                            {notification.status === "rejected" ? "Cancelled" : "Cancel"}
                          </button>
                        </div>
                      )}
                    </div>

                    {isUnread && !isInvitation && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
